import React, { useState, useEffect } from 'react';
import { Layers, Check, ExternalLink, MapPin, DollarSign, Send, AlertCircle, CreditCard, Plus, Trash2, Star, Receipt, Calendar, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import ConfirmationModal from '../common/ConfirmationModal';
import { paymentService } from '../../supabase/api/paymentService';
import campaignService from '../../supabase/api/campaignService';
import toast from 'react-hot-toast';
import './BillingTab.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const BillingTab = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [zipAggregation, setZipAggregation] = useState(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(true);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Delete confirmation modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [paymentMethodToRemove, setPaymentMethodToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    loadZipCodeAggregation();
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoadingMethods(true);
      setIsCheckingPayment(true);

      const methods = await paymentService.getPaymentMethods();
      setPaymentMethods(methods || []);
      setHasPaymentMethod(methods && methods.length > 0);
    } catch (error) {
      console.error('[BillingTab] Failed to load payment methods:', error);
      setPaymentMethods([]);
      setHasPaymentMethod(false);
    } finally {
      setLoadingMethods(false);
      setIsCheckingPayment(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId) => {
    try {
      setProcessingAction(`default-${paymentMethodId}`);

      const result = await paymentService.setDefaultPaymentMethod(paymentMethodId);

      if (result.success) {
        toast.success('Default payment method updated');
        loadPaymentMethods();
      } else {
        toast.error(result.error || 'Failed to update default payment method');
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      toast.error('Failed to update default payment method');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRemovePaymentMethod = (paymentMethod) => {
    setPaymentMethodToRemove(paymentMethod);
    setShowRemoveModal(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!paymentMethodToRemove) return;

    try {
      setIsRemoving(true);
      setProcessingAction(`remove-${paymentMethodToRemove.id}`);

      const result = await paymentService.removePaymentMethod(paymentMethodToRemove.id);

      if (result.success) {
        toast.success('Payment method removed');
        loadPaymentMethods();
      } else {
        toast.error(result.error || 'Failed to remove payment method');
      }

      // Close modal
      setShowRemoveModal(false);
      setPaymentMethodToRemove(null);
    } catch (error) {
      console.error('Error removing payment method:', error);
      toast.error('Failed to remove payment method');
    } finally {
      setIsRemoving(false);
      setProcessingAction(null);
    }
  };

  const loadZipCodeAggregation = async () => {
    try {
      setIsLoading(true);

      // Get all campaigns
      const { campaigns } = await campaignService.getCampaigns();

      // Aggregate ZIP code usage
      const zipMap = new Map();
      let totalPostcardsSent = 0;

      campaigns.forEach(campaign => {
        const zips = campaign.target_zip_codes || [];
        const postcardsSent = campaign.postcards_sent || 0;

        totalPostcardsSent += postcardsSent;

        zips.forEach(zip => {
          if (!zipMap.has(zip)) {
            zipMap.set(zip, {
              zipCode: zip,
              campaignCount: 0,
              totalPostcards: 0,
              totalCost: 0
            });
          }

          const zipData = zipMap.get(zip);
          zipData.campaignCount += 1;
          zipData.totalPostcards += postcardsSent;
          zipData.totalCost += postcardsSent * 3.00; // $3 per postcard
          zipMap.set(zip, zipData);
        });
      });

      const zipList = Array.from(zipMap.values())
        .sort((a, b) => b.totalPostcards - a.totalPostcards);

      const totalCost = zipList.reduce((sum, zip) => sum + zip.totalCost, 0);

      setZipAggregation({
        totalZipCodes: zipList.length,
        totalPostcardsSent,
        totalCost,
        zipList
      });
    } catch (error) {
      console.error('Error loading ZIP code aggregation:', error);
      toast.error('Failed to load billing data');
      setZipAggregation({
        totalZipCodes: 0,
        totalPostcardsSent: 0,
        totalCost: 0,
        zipList: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    // Check if user has payment method before opening portal
    if (!hasPaymentMethod) {
      toast.error('Please add a payment method before accessing the billing portal', {
        duration: 5000
      });
      return;
    }

    try {
      setIsLoadingPortal(true);
      toast.loading('Opening billing portal...', { id: 'billing-portal' });

      // Add timeout to prevent infinite hang (60 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 60000)
      );

      const portalPromise = paymentService.createCustomerPortalSession(window.location.href);

      // Race between portal creation and timeout
      const { url } = await Promise.race([portalPromise, timeoutPromise]);

      // Redirect to Stripe Customer Portal
      window.location.href = url;

      toast.success('Redirecting to billing portal...', { id: 'billing-portal' });
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error(error.message || 'Failed to open billing portal', { id: 'billing-portal' });
    } finally {
      // Only clear loading state if we're still on this page (redirect failed or errored)
      // If redirect succeeded, page will navigate away before this runs
      setIsLoadingPortal(false);
    }
  };

  return (
    <div className="billing-tab">
      {/* Billing & Invoices Header */}
      <h2 className="billing-title">Billing & Usage</h2>

      {/* Current Plan Card */}
      <div className="plan-card">
        <div className="plan-card-header">
          <div className="plan-icon">
            <Layers size={20} />
          </div>
          <div className="plan-info">
            <h3 className="plan-name">Pay As You Go</h3>
          </div>
          <div className="plan-status">
            <Check size={20} color="#20B2AA" strokeWidth={2} />
          </div>
        </div>
        <div className="plan-details">
          <div className="plan-price">
            <span className="price-amount">$3.00</span>
            <span className="price-period">per postcard</span>
          </div>
          <p className="plan-description">Only pay for postcards you send. No monthly fees or hidden charges.</p>
          <div className="plan-badge">
            • No commitment • Cancel anytime
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="payment-methods-section">
        <div className="section-header">
          <div>
            <h3>Payment Methods</h3>
            <p className="section-subtitle">Manage your saved payment methods</p>
          </div>
          {!showAddCard && paymentMethods.length > 0 && (
            <motion.button
              className="add-payment-btn"
              onClick={() => setShowAddCard(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={18} />
              Add Card
            </motion.button>
          )}
        </div>

        {loadingMethods ? (
          <div className="loading-payment-methods">
            <Loader className="spinner-icon" size={32} />
            <p>Loading payment methods...</p>
          </div>
        ) : (
          <>
            {paymentMethods.length === 0 && !showAddCard ? (
              <div className="no-payment-methods">
                <CreditCard size={48} />
                <p>No payment methods on file</p>
                <span>Add a payment method to enable automatic billing</span>
                <motion.button
                  className="add-first-payment-btn"
                  onClick={() => setShowAddCard(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={18} />
                  Add Payment Method
                </motion.button>
              </div>
            ) : (
              <div className="payment-methods-list">
                {paymentMethods.map((method) => (
                  <motion.div
                    key={method.id}
                    className={`payment-method-card ${method.is_default ? 'default' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="payment-method-icon">
                      <CreditCard size={24} />
                    </div>

                    <div className="payment-method-info">
                      <div className="card-brand-row">
                        <span className="card-brand">{method.card_brand}</span>
                        {method.is_default && (
                          <span className="default-badge">
                            <Star size={12} fill="currentColor" />
                            Default
                          </span>
                        )}
                      </div>
                      <span className="card-number">•••• {method.card_last4}</span>
                      <span className="card-expiry">
                        <Calendar size={14} />
                        Expires {String(method.card_exp_month).padStart(2, '0')}/{method.card_exp_year}
                      </span>
                    </div>

                    <div className="payment-method-actions">
                      {!method.is_default && (
                        <motion.button
                          className="set-default-btn"
                          onClick={() => handleSetDefaultPaymentMethod(method.id)}
                          disabled={processingAction === `default-${method.id}`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {processingAction === `default-${method.id}` ? (
                            <Loader className="btn-spinner" size={14} />
                          ) : (
                            <Star size={14} />
                          )}
                          {processingAction === `default-${method.id}` ? 'Setting...' : 'Set as Default'}
                        </motion.button>
                      )}

                      <motion.button
                        className="remove-payment-btn"
                        onClick={() => handleRemovePaymentMethod(method)}
                        disabled={processingAction === `remove-${method.id}` || (method.is_default && paymentMethods.length > 1)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={method.is_default && paymentMethods.length > 1 ? 'Set another card as default before removing' : 'Remove payment method'}
                      >
                        {processingAction === `remove-${method.id}` ? (
                          <Loader className="btn-spinner" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Add Payment Method Form */}
            <AnimatePresence>
              {showAddCard && (
                <motion.div
                  className="add-payment-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Elements stripe={stripePromise}>
                    <AddPaymentMethodForm
                      onSuccess={() => {
                        setShowAddCard(false);
                        loadPaymentMethods();
                      }}
                      onCancel={() => setShowAddCard(false)}
                    />
                  </Elements>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Billing Portal Button */}
      <div className="billing-portal-section">
        <div className="portal-description">
          <h3>Manage Billing Details</h3>
          <p className="section-subtitle">
            Update payment methods, view invoices, and manage your billing information through our secure Stripe portal.
          </p>
        </div>

        {/* Warning if no payment method */}
        {!isCheckingPayment && !hasPaymentMethod && (
          <div className="warning-banner" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '8px',
            marginBottom: '16px',
            color: '#92400E'
          }}>
            <AlertCircle size={20} color="#F59E0B" />
            <div>
              <strong>No payment method on file.</strong>
              <p style={{ margin: 0, fontSize: '14px' }}>Add a payment method below to enable automatic billing and access the billing portal.</p>
            </div>
          </div>
        )}

        <motion.button
          className="billing-portal-button"
          onClick={handleOpenBillingPortal}
          disabled={isLoadingPortal || isCheckingPayment || !hasPaymentMethod}
          whileHover={hasPaymentMethod ? { scale: 1.02 } : {}}
          whileTap={hasPaymentMethod ? { scale: 0.98 } : {}}
          style={{
            opacity: (!hasPaymentMethod || isCheckingPayment) ? 0.5 : 1,
            cursor: (!hasPaymentMethod || isCheckingPayment) ? 'not-allowed' : 'pointer'
          }}
        >
          {isCheckingPayment ? (
            <>
              <div className="button-spinner"></div>
              Checking...
            </>
          ) : isLoadingPortal ? (
            <>
              <div className="button-spinner"></div>
              Opening Portal...
            </>
          ) : (
            <>
              <ExternalLink size={18} />
              {hasPaymentMethod ? 'Manage Billing' : 'Add Payment Method'}
            </>
          )}
        </motion.button>
      </div>

      {/* Usage Summary */}
      {isLoading ? (
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Loading usage data...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="usage-summary">
            <h3>Usage Summary</h3>
            <div className="summary-cards">
              <motion.div
                className="summary-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0 }}
              >
                <div className="card-icon zip-icon">
                  <MapPin size={24} />
                </div>
                <div className="card-content">
                  <div className="card-value">{zipAggregation.totalZipCodes}</div>
                  <div className="card-label">ZIP Code{zipAggregation.totalZipCodes !== 1 ? 's' : ''} Used</div>
                </div>
              </motion.div>

              <motion.div
                className="summary-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="card-icon postcards-icon">
                  <Send size={24} />
                </div>
                <div className="card-content">
                  <div className="card-value">{zipAggregation.totalPostcardsSent.toLocaleString()}</div>
                  <div className="card-label">Postcard{zipAggregation.totalPostcardsSent !== 1 ? 's' : ''} Sent</div>
                </div>
              </motion.div>

              <motion.div
                className="summary-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="card-icon cost-icon">
                  <DollarSign size={24} />
                </div>
                <div className="card-content">
                  <div className="card-value">${zipAggregation.totalCost.toFixed(2)}</div>
                  <div className="card-label">Total Spent</div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ZIP Code Breakdown */}
          {zipAggregation.zipList.length > 0 && (
            <div className="zip-breakdown-section">
              <div className="breakdown-header">
                <h3>ZIP Code Usage Breakdown</h3>
                <p className="breakdown-subtitle">View your postcard costs by ZIP code</p>
              </div>

              <div className="zip-breakdown-table">
                <div className="table-header">
                  <div className="table-cell zip-cell">ZIP Code</div>
                  <div className="table-cell campaigns-cell">Campaigns</div>
                  <div className="table-cell postcards-cell">Postcards</div>
                  <div className="table-cell cost-cell">Cost</div>
                </div>

                {zipAggregation.zipList.map((zip, index) => (
                  <motion.div
                    key={zip.zipCode}
                    className="table-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                  >
                    <div className="table-cell zip-cell">
                      <MapPin size={16} className="zip-icon-small" />
                      <span className="zip-code-value">{zip.zipCode}</span>
                    </div>
                    <div className="table-cell campaigns-cell">
                      <span className="campaign-count">{zip.campaignCount}</span>
                    </div>
                    <div className="table-cell postcards-cell">
                      <span className="postcards-count">{zip.totalPostcards.toLocaleString()}</span>
                    </div>
                    <div className="table-cell cost-cell">
                      <span className="cost-value">${zip.totalCost.toFixed(2)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="pricing-note">
                <DollarSign size={14} />
                <span>All postcards are charged at $3.00 per postcard, per ZIP code.</span>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .loading-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #E2E8F0;
          border-top-color: #20B2AA;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-section p {
          color: #718096;
          font-size: 14px;
          margin: 0;
        }

        .billing-portal-section {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .portal-description h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1A202C;
          margin: 0 0 8px 0;
        }

        .section-subtitle {
          font-size: 14px;
          color: #718096;
          margin: 0;
          line-height: 1.6;
        }

        .billing-portal-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          background: #20B2AA;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .billing-portal-button:hover:not(:disabled) {
          background: #17a097;
          box-shadow: 0 6px 16px rgba(32, 178, 170, 0.3);
        }

        .billing-portal-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #ffffff40;
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .usage-summary {
          margin-top: 32px;
        }

        .usage-summary h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1A202C;
          margin: 0 0 20px 0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .summary-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.2s ease;
        }

        .summary-card:hover {
          border-color: #CBD5E0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .zip-icon {
          background: #EBF8FF;
          color: #3182CE;
        }

        .postcards-icon {
          background: #F0FFF4;
          color: #38A169;
        }

        .cost-icon {
          background: #FFFBEB;
          color: #D97706;
        }

        .card-content {
          flex: 1;
        }

        .card-value {
          font-size: 24px;
          font-weight: 700;
          color: #1A202C;
          margin-bottom: 4px;
        }

        .card-label {
          font-size: 13px;
          color: #718096;
          font-weight: 500;
        }

        .zip-breakdown-section {
          margin-top: 32px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 24px;
        }

        .breakdown-header {
          margin-bottom: 24px;
        }

        .breakdown-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1A202C;
          margin: 0 0 6px 0;
        }

        .breakdown-subtitle {
          font-size: 14px;
          color: #718096;
          margin: 0;
        }

        .zip-breakdown-table {
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          overflow: hidden;
        }

        .table-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1.5fr 1fr;
          background: #F7FAFC;
          border-bottom: 1px solid #E2E8F0;
          font-size: 12px;
          font-weight: 600;
          color: #4A5568;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table-cell {
          padding: 14px 16px;
        }

        .table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1.5fr 1fr;
          border-bottom: 1px solid #E2E8F0;
          transition: all 0.2s ease;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: #F7FAFC;
        }

        .zip-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #2D3748;
        }

        .zip-icon-small {
          color: #3182CE;
          flex-shrink: 0;
        }

        .zip-code-value {
          font-family: 'Courier New', monospace;
        }

        .campaign-count,
        .postcards-count {
          color: #4A5568;
        }

        .cost-value {
          font-weight: 600;
          color: #2D3748;
        }

        .pricing-note {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 16px;
          background: #FFFBEB;
          border-left: 3px solid #F59E0B;
          border-radius: 6px;
          font-size: 13px;
          color: #92400E;
        }

        .pricing-note svg {
          flex-shrink: 0;
          color: #F59E0B;
        }

        /* Tablet/Medium screens - make button full width earlier to prevent squeezing */
        @media (max-width: 1024px) {
          .billing-portal-section {
            flex-direction: column;
            align-items: stretch;
          }

          .portal-description {
            text-align: center;
          }

          .billing-portal-button {
            width: 100%;
            justify-content: center;
          }
        }

        /* Fine-tune button on mid-size screens */
        @media (max-width: 900px) and (min-width: 769px) {
          .billing-portal-button {
            padding: 12px 20px;
            font-size: 13px;
          }
        }

        @media (max-width: 768px) {
          .billing-portal-section {
            flex-direction: column;
            align-items: stretch;
          }

          .billing-portal-button {
            width: 100%;
            justify-content: center;
          }

          .summary-cards {
            grid-template-columns: 1fr;
          }

          .table-header,
          .table-row {
            grid-template-columns: 1.5fr 0.8fr 1fr 0.8fr;
            font-size: 13px;
          }

          .table-cell {
            padding: 12px 10px;
          }

          .zip-cell {
            gap: 6px;
          }

          .card-value {
            font-size: 20px;
          }
        }
      `}</style>

      <ConfirmationModal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setPaymentMethodToRemove(null);
        }}
        onConfirm={confirmRemovePaymentMethod}
        title="Remove Payment Method"
        message={
          paymentMethodToRemove ? (
            <>
              Are you sure you want to remove the card ending in <strong>****{paymentMethodToRemove.last4}</strong>?
            </>
          ) : (
            'Are you sure you want to remove this payment method?'
          )
        }
        confirmText="Remove Payment Method"
        cancelText="Cancel"
        severity="warning"
        isLoading={isRemoving}
        loadingText="Removing..."
      />
    </div>
  );
};

// Add Payment Method Form Component
const AddPaymentMethodForm = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the CardElement
      const cardElement = elements.getElement(CardElement);

      console.log('[BillingTab] Starting payment method addition...');

      // ✅ FIX: Pass stripe instance to service
      const result = await paymentService.savePaymentMethod(stripe, cardElement);

      console.log('[BillingTab] Payment method result:', result);

      if (result.success) {
        toast.success('Payment method added successfully');
        onSuccess();
      } else {
        console.error('[BillingTab] Payment failed:', result.error);
        setError(result.error || 'Failed to add payment method');
        toast.error(result.error || 'Failed to add payment method');
      }
    } catch (err) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1A202C',
        '::placeholder': {
          color: '#9CA3AF',
        },
      },
      invalid: {
        color: '#E53E3E',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <h4>Add New Payment Method</h4>

      <div className="stripe-card-element">
        <CardElement options={cardElementOptions} />
      </div>

      {error && <div className="card-error">{error}</div>}

      <div className="form-actions">
        <button
          type="button"
          className="cancel-btn"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="submit-btn"
          disabled={!stripe || loading}
        >
          {loading ? (
            <>
              <Loader className="btn-spinner" size={16} />
              Adding...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Add Payment Method
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default BillingTab;