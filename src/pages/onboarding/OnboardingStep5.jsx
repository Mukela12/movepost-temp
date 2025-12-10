import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Shield } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { paymentService } from '../../supabase/api/paymentService';
import onboardingService from '../../supabase/api/onboardingService';
import './onboarding-step5.css';

// Initialize Stripe - make sure this is outside the component
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Initialize Stripe with error handling
let stripePromise;
let stripeLoadError = false;

if (!stripeKey) {
  console.error('❌ VITE_STRIPE_PUBLISHABLE_KEY is missing!');
  console.error('   Add it to your .env file:');
  console.error('   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...');
  stripeLoadError = true;
} else {
  // Load Stripe with error handling
  stripePromise = loadStripe(stripeKey).catch(err => {
    console.error('❌ Failed to load Stripe.js:', err);
    console.error('   This is usually caused by:');
    console.error('   1. Network connectivity issues');
    console.error('   2. DNS resolution problems');
    console.error('   3. Browser extensions blocking scripts');
    console.error('   4. VPN/proxy blocking stripe.com');
    stripeLoadError = true;
    return null;
  });
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#9CA3AF',
      },
      iconColor: '#6B7280',
    },
    invalid: {
      color: '#DC2626',
      iconColor: '#DC2626',
    },
    complete: {
      color: '#059669',
      iconColor: '#059669',
    },
  },
  hidePostalCode: true,
};

const PaymentForm = ({ onSuccess, email }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [cardReady, setCardReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);


  useEffect(() => {
    const initializeSetupIntent = async () => {
      if (!email) {
        setIsInitializing(false);
        return;
      }

      try {
        setIsInitializing(true);
        
        const { clientSecret } = await paymentService.createSetupIntent(email);
        
        setClientSecret(clientSecret);
        setError(null);
      } catch (err) {
        setError(err.message);
        toast.error('Failed to initialize payment setup');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSetupIntent();
  }, [email]);

  const handleCardReady = (element) => {
    console.log('✅ Card element ready and mounted');
    setCardReady(true);
    setError(null); // Clear any previous errors

    // Force focus after a brief delay to ensure interactivity
    setTimeout(() => {
      if (element) {
        try {
          element.focus();
        } catch (err) {
          console.warn('Could not focus card element:', err);
        }
      }
    }, 100);
  };

  const handleCardChange = (event) => {
    console.log('💳 Card change event:', {
      complete: event.complete,
      empty: event.empty,
      error: event.error?.message,
    });

    setCardComplete(event.complete);
    
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Enhanced validation with better error messages
    if (!stripe) {
      console.error('❌ Stripe is not initialized');
      setError('Payment system failed to load. Please refresh the page or try again later.');
      toast.error('Payment system not available');
      return;
    }

    if (!elements) {
      console.error('❌ Stripe Elements not available');
      setError('Card form not loaded. Please refresh the page.');
      toast.error('Card form not loaded');
      return;
    }

    if (!clientSecret) {
      console.warn('⚠️ Cannot submit - missing client secret');
      toast.error('Payment system not ready. Please wait...');
      return;
    }

    if (!cardComplete) {
      setError('Please complete all card details');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: email,
            },
          },
        }
      );

      if (stripeError) {
        console.error('❌ Stripe error:', stripeError);
        throw new Error(stripeError.message);
      }


      if (setupIntent.status === 'succeeded') {
        
        // Confirm with backend
        await paymentService.confirmSetupIntent(setupIntent.id);
        
        // Update onboarding progress
        await paymentService.updateOnboardingProgress(5, {
          payment_completed: true,
        });

        toast.success('Payment method added successfully!');
        onSuccess();
      } else {
        throw new Error(`Setup intent status: ${setupIntent.status}`);
      }
    } catch (err) {
      console.error('❌ Payment error:', err);
      setError(err.message);
      toast.error(err.message || 'Payment setup failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading state
  if (isInitializing) {
    return (
      <div className="payment-form-stripe">
        <div className="payment-section">
          <h3 className="section-title">Card Information</h3>
          <div className="loading-state">
            <div className="spinner-small"></div>
            <p>Initializing secure payment...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="payment-form-stripe">
        <div className="payment-section">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center',
            gap: '1rem'
          }}>
            <div className="spinner-small"></div>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              Preparing payment form...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="payment-form-stripe">
      <div className="payment-section">
        <h3 className="section-title">Card Information</h3>

        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            padding: '8px',
            background: '#F3F4F6',
            borderRadius: '4px',
            fontSize: '12px',
            marginBottom: '12px',
            fontFamily: 'monospace'
          }}>
          </div>
        )}

        <div className="card-element-wrapper">
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onReady={handleCardReady}
            onChange={handleCardChange}
          />
        </div>

        {!cardReady && (
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>
            Loading card input...
          </p>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle size={20} color="#EF4444" />
            {error}
          </div>
        )}

        <div className="privacy-notice">
          <Shield size={16} color="#6B7280" />
          Your payment information is securely processed by Stripe. We never store your full card details.
        </div>
      </div>

      <button
        type="submit"
        className="continue-button"
        disabled={!stripe || isProcessing || !clientSecret || !cardReady || !cardComplete}
      >
        {isProcessing ? (
          <>
            <div className="spinner-small"></div>
            Processing...
          </>
        ) : (
          'Save & Continue'
        )}
      </button>
    </form>
  );
};

const OnboardingStep5 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [stripeError, setStripeError] = useState(false);

  const steps = [
    { number: 1, title: 'Business URL', subtitle: 'Please provide email' },
    { number: 2, title: 'Select Postcard Template', subtitle: 'Setup your template' },
    { number: 3, title: 'Postcard Editor', subtitle: 'Customize your campaign' },
    { number: 4, title: 'Targeting & Budget', subtitle: 'Setup your business financial goals' },
    { number: 5, title: 'Payment Setup', subtitle: 'Provide payment flow' },
    { number: 6, title: 'Launch Campaign', subtitle: 'Finish your website setup' },
  ];

  useEffect(() => {
    loadPaymentMethods();

    // Check if Stripe loaded successfully
    if (stripePromise) {
      stripePromise.then(stripe => {
        if (stripe) {
          setStripeInitialized(true);
          setStripeError(false);
        } else {
          setStripeInitialized(false);
          setStripeError(true);
        }
      }).catch(() => {
        setStripeInitialized(false);
        setStripeError(true);
      });
    } else {
      setStripeError(true);
    }
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const methods = await paymentService.getPaymentMethods();
      setSavedPaymentMethods(methods || []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setSavedPaymentMethods([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/onboarding/step4');
  };

  const handlePaymentSuccess = async () => {
    // Mark step 5 as complete
    await onboardingService.markStepComplete(5);
    navigate('/onboarding/step6');
  };

  const handleSkipPayment = async () => {
    try {
      // Ensure customer record exists even when payment is skipped
      // This prevents 406 errors when accessing billing later
      // Note: In most cases, customer should already exist from signup trigger
      if (user?.email) {
        try {
          console.log('[OnboardingStep5] Ensuring customer record exists (skipped payment)');
          await paymentService.createCustomerRecord();
          console.log('[OnboardingStep5] Customer record verified/created successfully');
        } catch (customerError) {
          // Don't block onboarding if customer creation fails
          // They can add payment later from billing page
          console.warn('[OnboardingStep5] Could not create customer record:', customerError);
        }
      }

      toast.success('Payment setup skipped. You can add payment details later.');
      // Mark step 5 as complete
      await onboardingService.markStepComplete(5);
      navigate('/onboarding/step6');
    } catch (error) {
      console.error('[OnboardingStep5] Error in handleSkipPayment:', error);
      // Still navigate - don't block user
      toast.success('Payment setup skipped. You can add payment details later.');
      navigate('/onboarding/step6');
    }
  };

  return (
    <OnboardingLayout
      steps={steps}
      currentStep={5}
      footerMessage="Add your payment details below to set up billing, or click 'Skip for Now' to continue"
      onContinue={handleSkipPayment}
      continueText="Skip for Now"
      continueDisabled={false}
    >
      <div className="main-content">
        <button className="back-button" onClick={handleBack}>
          <ChevronLeft size={18} />
          Back
        </button>

        <h1 className="main-title">Payment Setup</h1>

        <div className="payment-form">
          {/* Billing Information Display */}
          <div className="payment-section">
            <h3 className="section-title">Billing Information</h3>
            {user?.email && (
              <div style={{
                padding: '12px 16px',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#6B7280'
              }}>
                Billing email: <strong style={{ color: '#111827' }}>{user.email}</strong>
              </div>
            )}
          </div>

          {/* Saved Payment Methods */}
          {!isLoading && savedPaymentMethods.length > 0 && (
            <div className="payment-section">
              <h3 className="section-title">Saved Payment Methods</h3>
              {savedPaymentMethods.map((method) => (
                <div key={method.id} className="payment-method-card saved">
                  <div className="payment-method-header">
                    <div className="card-info">
                      <span className="card-brand">{method.card_brand?.toUpperCase()}</span>
                      <span className="card-number">•••• {method.card_last4}</span>
                    </div>
                    <div className="card-expiry">
                      Expires {method.card_exp_month}/{method.card_exp_year}
                    </div>
                    {method.is_default && (
                      <span className="default-badge">Default</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stripe Elements Form or Error Fallback */}
          {stripeError ? (
            <div className="payment-section">
              <div style={{
                padding: '2rem',
                background: '#FEF3C7',
                border: '2px solid #F59E0B',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                  <AlertCircle size={24} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#92400E' }}>
                      Unable to Load Payment System
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#78350F', lineHeight: '1.6' }}>
                      We're having trouble connecting to our payment processor. This is usually caused by:
                    </p>
                    <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', fontSize: '14px', color: '#78350F' }}>
                      <li>Network connectivity issues</li>
                      <li>Browser extensions blocking scripts (especially crypto wallets)</li>
                      <li>VPN or firewall blocking payment services</li>
                      <li>DNS resolution problems</li>
                    </ul>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#92400E' }}>
                      Quick Fixes:
                    </p>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '14px', color: '#78350F' }}>
                      <li>Try refreshing the page (Ctrl/Cmd + R)</li>
                      <li>Disable browser extensions temporarily</li>
                      <li>Try in an incognito/private window</li>
                      <li>Check your internet connection</li>
                    </ul>
                  </div>
                </div>
                <div style={{
                  padding: '12px 16px',
                  background: '#FEF3C7',
                  borderLeft: '3px solid #F59E0B',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#92400E',
                  marginTop: '16px'
                }}>
                  <strong>Don't worry!</strong> You can skip payment setup now and add your card later from Settings → Billing.
                </div>
              </div>
            </div>
          ) : !user?.email ? (
            <div className="payment-section">
              <p style={{ color: '#DC2626', textAlign: 'center', padding: '2rem', background: '#FEE2E2', borderRadius: '8px' }}>
                Unable to load payment form. Please ensure you are logged in.
              </p>
            </div>
          ) : (
            <Elements stripe={stripePromise}>
              <PaymentForm onSuccess={handlePaymentSuccess} email={user.email} />
            </Elements>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingStep5;