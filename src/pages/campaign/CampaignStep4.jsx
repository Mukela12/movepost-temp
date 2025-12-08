import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, CheckSquare, Trash2, CheckCircle, AlertCircle, DollarSign, XCircle } from 'lucide-react';
import ProcessLayout from '../../components/process/ProcessLayout';
import newMoverService from '../../supabase/api/newMoverService';
import { parseMultipleZipCodes } from '../../utils/zipCode';
import { calculatePostcardCost, formatPrice } from '../../utils/pricing';
import toast from 'react-hot-toast'

const CampaignStep4 = () => {
  const navigate = useNavigate();

  // State for ZIP codes
  const [zipCodes, setZipCodes] = useState([]);
  const [zipCodeInput, setZipCodeInput] = useState('');

  // ZIP validation data
  const [zipValidation, setZipValidation] = useState(null);
  const [validatedZips, setValidatedZips] = useState([]);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [validatingZips, setValidatingZips] = useState(false);

  const totalSteps = 5;

  // Handle ZIP code input
  const handleZipCodeInputChange = (e) => {
    setZipCodeInput(e.target.value);
  };

  // Handle smart ZIP code parsing and validation
  const handleValidateZips = async () => {
    const input = zipCodeInput.trim();

    if (!input) {
      toast.error('Please enter ZIP codes');
      return;
    }

    try {
      // Parse the input
      const parsed = parseMultipleZipCodes(input);

      if (parsed.errors && parsed.errors.length > 0) {
        parsed.errors.forEach(error => toast.error(error, { duration: 3000 }));
      }

      if (!parsed.zipCodes || parsed.zipCodes.length === 0) {
        toast.error('No valid ZIP codes found');
        return;
      }

      setZipCodes(parsed.zipCodes);

      // Validate ZIP codes
      setValidatingZips(true);
      toast.loading('Validating ZIP codes...', { id: 'validate-zips' });

      const result = await newMoverService.validateZipCodes(parsed.zipCodes);

      if (result.success) {
        setZipValidation(result);
        setValidatedZips(result.results);

        if (result.zipsWithData > 0) {
          toast.success(`${result.zipsWithData} ZIP code${result.zipsWithData !== 1 ? 's' : ''} validated!`, {
            id: 'validate-zips',
            duration: 3000
          });

          // Store validated ZIP codes WITHOUT fetching Melissa data
          // New movers will be discovered via polling after campaign activation
          sessionStorage.setItem('campaignTargetingData', JSON.stringify({
            option: 'zip',
            zipCodes: parsed.zipCodes,
            validatedZips: result.results,
            zipsWithData: result.zipsWithData,
            totalZipCodes: result.totalZipCodes,
            flatRate: result.flatRate,
            newMoverIds: [], // Empty - will be populated by polling
            totalRecipients: 0, // Start with 0 - will increment as new movers are discovered
            pollingEnabled: true // Enable polling for this campaign
          }));
        } else {
          toast.error('No data available for these ZIP codes', { id: 'validate-zips' });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Failed to validate ZIP codes: ${error.message}`, {
        id: 'validate-zips',
        duration: 5000
      });
    } finally {
      setValidatingZips(false);
    }
  };

  // Clear ZIP codes
  const handleClearZips = () => {
    setZipCodes([]);
    setZipCodeInput('');
    setZipValidation(null);
    setValidatedZips([]);
  };

  const handleBack = () => {
    navigate('/campaign/step3');
  };

  const handleContinue = async () => {
    if (!canContinue()) {
      toast.error('All ZIP codes must be valid before continuing. Please remove or fix invalid ZIP codes.');
      return;
    }

    localStorage.setItem('currentCampaignStep', '5');
    navigate('/campaign/step5');
  };

  const canContinue = () => {
    // ALL zip codes must be valid (no invalid zips allowed)
    return zipValidation && zipValidation.allValid === true && zipValidation.validZips > 0;
  };

  return (
    <ProcessLayout
      currentStep={4}
      totalSteps={totalSteps}
      footerMessage="All ZIP codes must be valid before continuing. Invalid ZIP codes will block progress."
      onContinue={handleContinue}
      continueDisabled={!canContinue() || loading}
      continueText={loading ? 'Processing...' : 'Continue'}
      onSkip={() => navigate('/dashboard')}
      skipText="Cancel"
    >
      <motion.button
        className="process-back-button"
        onClick={handleBack}
        whileHover={{ scale: 1.02, x: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <ChevronLeft size={18} />
        Back
      </motion.button>

      <h1 className="process-title">Targeting & Budget</h1>

        {/* ZIP Codes Form */}
        <div className="targeting-form zip-targeting-form">
            {!zipValidation ? (
              <>
                {/* Smart ZIP Code Input */}
                <div className="zip-input-section">
                  <label className="zip-input-label">
                    <MapPin size={20} />
                    Enter ZIP Code(s) *
                  </label>

                  <div className="smart-zip-input">
                    <input
                      type="text"
                      className="zip-input-field"
                      placeholder="Enter ZIP codes (e.g., 10001-10005 or 10001, 10002, 10010)"
                      value={zipCodeInput}
                      onChange={handleZipCodeInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !validatingZips) {
                          e.preventDefault();
                          handleValidateZips();
                        }
                      }}
                      disabled={validatingZips}
                    />
                  </div>

                  <div className="input-examples">
                    <span className="example-label">Examples:</span>
                    <span className="example-item">10001</span>
                    <span className="example-divider">•</span>
                    <span className="example-item">10001-10005</span>
                    <span className="example-divider">•</span>
                    <span className="example-item">10001, 10002, 10010</span>
                  </div>

                  <motion.button
                    className="find-movers-button"
                    onClick={handleValidateZips}
                    disabled={!zipCodeInput.trim() || validatingZips}
                    whileHover={{ scale: 1.02, boxShadow: "0 6px 16px rgba(32, 178, 170, 0.25)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {validatingZips ? (
                      <>
                        <div className="button-spinner"></div>
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare size={20} />
                        <span>Validate ZIP Codes</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </>
            ) : (
              <>
                {/* Validation Results Display */}
                <div className="results-section">
                  <div className="results-header">
                    <div className="results-icon-wrapper">
                      <CheckSquare size={28} color="#20B2AA" strokeWidth={2.5} />
                    </div>
                    <div className="results-title">
                      <h3>ZIP Code Validation Results</h3>
                      <p className="results-zip-info">{zipValidation.totalZipCodes} ZIP code{zipValidation.totalZipCodes !== 1 ? 's' : ''} checked</p>
                    </div>
                    <motion.button
                      className="clear-button"
                      onClick={handleClearZips}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Trash2 size={18} />
                      Clear
                    </motion.button>
                  </div>

                  <div className="validation-summary">
                    <motion.div
                      className="summary-card success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0 }}
                    >
                      <div className="summary-icon">
                        <CheckCircle size={24} strokeWidth={2.5} />
                      </div>
                      <div className="summary-content">
                        <div className="summary-number">{zipValidation.zipsWithData}</div>
                        <div className="summary-label">ZIP{zipValidation.zipsWithData !== 1 ? 's' : ''} with Data</div>
                      </div>
                    </motion.div>

                    {zipValidation.zipsWithoutData > 0 && (
                      <div className="summary-card warning">
                        <div className="summary-icon">
                          <AlertCircle size={24} strokeWidth={2.5} />
                        </div>
                        <div className="summary-content">
                          <div className="summary-number">{zipValidation.zipsWithoutData}</div>
                          <div className="summary-label">ZIP{zipValidation.zipsWithoutData !== 1 ? 's' : ''} without Data</div>
                        </div>
                      </div>
                    )}

                    <div className="summary-card flat-rate">
                      <div className="summary-icon">
                        <DollarSign size={24} strokeWidth={2.5} />
                      </div>
                      <div className="summary-content">
                        <div className="summary-number">${zipValidation.flatRate.toFixed(2)}</div>
                        <div className="summary-label">Per Postcard</div>
                      </div>
                    </div>
                  </div>

                  {/* ZIP Code Status List */}
                  <div className="zip-status-section">
                    <h4 className="zip-status-title">ZIP Code Status</h4>
                    <div className="zip-status-list">
                      {validatedZips.map((zip, index) => (
                        <div key={index} className={`zip-status-item ${zip.hasData ? 'has-data' : 'no-data'}`}>
                          <div className="zip-status-icon">
                            {zip.hasData ? (
                              <CheckCircle size={20} strokeWidth={2.5} />
                            ) : (
                              <XCircle size={20} strokeWidth={2.5} />
                            )}
                          </div>
                          <div className="zip-status-code">{zip.zipCode}</div>
                          <div className="zip-status-label">
                            {zip.hasData ? 'Data Available' : 'No Data'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {zipValidation.zipsWithData > 0 && (
                    <div className="results-footer">
                      <CheckCircle size={16} color="#10b981" strokeWidth={2} />
                      <span>Ready to continue with {zipValidation.zipsWithData} valid ZIP code{zipValidation.zipsWithData !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

      <style>{`
        /* ZIP Input Section */
        .zip-targeting-form {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .zip-input-section {
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .zip-input-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          color: #2D3748;
          margin-bottom: 16px;
          line-height: 1.2;
        }

        .zip-input-label svg {
          color: #20B2AA;
          flex-shrink: 0;
        }

        .smart-zip-input {
          margin-bottom: 12px;
        }

        .zip-input-field {
          width: 100%;
          padding: 14px 18px;
          font-size: 1rem;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          transition: all 0.2s ease;
          font-family: inherit;
          background: #F7FAFC;
        }

        .zip-input-field:hover {
          border-color: #CBD5E0;
          background: #ffffff;
        }

        .zip-input-field:focus {
          outline: none;
          border-color: #20B2AA;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(32, 178, 170, 0.1);
        }

        .zip-input-field:disabled {
          background: #EDF2F7;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .input-examples {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 0.8125rem;
          color: #718096;
          margin-bottom: 24px;
          padding: 12px 16px;
          background: #F7FAFC;
          border-radius: 8px;
        }

        .example-label {
          font-weight: 500;
          color: #4A5568;
        }

        .example-item {
          font-family: 'Courier New', monospace;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #E2E8F0;
          font-weight: 500;
          color: #20B2AA;
        }

        .example-divider {
          color: #CBD5E0;
        }

        .find-movers-button {
          width: 100%;
          padding: 16px 24px;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #20B2AA 0%, #17a097 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 12px rgba(32, 178, 170, 0.25);
        }

        .find-movers-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #17a097 0%, #128f84 100%);
          box-shadow: 0 6px 20px rgba(32, 178, 170, 0.35);
          transform: translateY(-2px);
        }

        .find-movers-button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(32, 178, 170, 0.25);
        }

        .find-movers-button:disabled {
          background: #CBD5E0;
          cursor: not-allowed;
          box-shadow: none;
        }

        .button-spinner {
          width: 18px;
          height: 18px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Results Section */
        .results-section {
          background: linear-gradient(135deg, #E6FFFA 0%, #F0FFF4 100%);
          border: 2px solid #20B2AA;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(32, 178, 170, 0.15);
          animation: slideInUp 0.4s ease-out;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .results-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px 28px;
          background: white;
          border-bottom: 1px solid rgba(32, 178, 170, 0.15);
        }

        .results-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #E6FFFA 0%, #B2F5EA 100%);
          border-radius: 12px;
          flex-shrink: 0;
        }

        .results-title {
          flex: 1;
        }

        .results-title h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #234E52;
          margin-bottom: 4px;
        }

        .results-zip-info {
          margin: 0;
          font-size: 0.875rem;
          color: #718096;
        }

        .clear-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #718096;
          background: #F7FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-button:hover {
          background: #EDF2F7;
          color: #4A5568;
          border-color: #CBD5E0;
        }

        /* Validation Summary */
        .validation-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          padding: 24px 28px;
          background: white;
          border-bottom: 1px solid rgba(32, 178, 170, 0.15);
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-radius: 12px;
          background: #F7FAFC;
          border: 2px solid #E2E8F0;
          transition: all 0.2s ease;
        }

        .summary-card.success {
          background: linear-gradient(135deg, #F0FFF4 0%, #E6FFFA 100%);
          border-color: #10b981;
        }

        .summary-card.warning {
          background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
          border-color: #F59E0B;
        }

        .summary-card.flat-rate {
          background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
          border-color: #3B82F6;
        }

        .summary-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 10px;
        }

        .summary-card.success .summary-icon {
          background: #10b981;
          color: white;
        }

        .summary-card.warning .summary-icon {
          background: #F59E0B;
          color: white;
        }

        .summary-card.flat-rate .summary-icon {
          background: #3B82F6;
          color: white;
        }

        .summary-content {
          flex: 1;
        }

        .summary-number {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 4px;
        }

        .summary-card.success .summary-number {
          color: #059669;
        }

        .summary-card.warning .summary-number {
          color: #D97706;
        }

        .summary-card.flat-rate .summary-number {
          color: #2563EB;
        }

        .summary-label {
          font-size: 0.8125rem;
          color: #4A5568;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        /* ZIP Status Section */
        .zip-status-section {
          padding: 24px 28px;
          background: white;
        }

        .zip-status-title {
          margin: 0 0 16px 0;
          font-size: 1rem;
          font-weight: 600;
          color: #234E52;
        }

        .zip-status-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }

        .zip-status-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 8px;
          background: #F7FAFC;
          border: 2px solid #E2E8F0;
          transition: all 0.2s ease;
        }

        .zip-status-item.has-data {
          background: #F0FDF4;
          border-color: #10b981;
        }

        .zip-status-item.has-data .zip-status-icon {
          color: #10b981;
        }

        .zip-status-item.no-data {
          background: #F7FAFC;
          border-color: #E2E8F0;
        }

        .zip-status-item.no-data .zip-status-icon {
          color: #9CA3AF;
        }

        .zip-status-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zip-status-code {
          flex: 1;
          font-size: 1rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: #2D3748;
        }

        .zip-status-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #718096;
        }

        .zip-status-item.has-data .zip-status-label {
          color: #059669;
        }

        .zip-status-item.no-data .zip-status-label {
          color: #9CA3AF;
        }

        .results-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 18px 28px;
          background: rgba(16, 185, 129, 0.1);
          font-size: 0.9rem;
          color: #047857;
          font-weight: 500;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .zip-input-section {
            padding: 24px;
          }

          .count-number {
            font-size: 2.5rem;
          }
        }
      `}</style>
    </ProcessLayout>
  );
};

export default CampaignStep4;
