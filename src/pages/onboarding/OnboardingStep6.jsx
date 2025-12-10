import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import { formatPrice } from '../../utils/pricing';
import campaignService from '../../supabase/api/campaignService';
import { paymentService } from '../../supabase/api/paymentService';
import onboardingService from '../../supabase/api/onboardingService';
import * as emailService from '../../supabase/api/emailService';
import { supabase } from '../../supabase/integration/client';
import toast from 'react-hot-toast';

// Helper function to notify admins of new campaign
const notifyAdminsOfNewCampaign = async (campaignName, campaignId, customerName, customerEmail) => {
  try {
    // Fetch all admin users
    const { data: admins, error } = await supabase
      .from('profile')
      .select('email, full_name')
      .in('role', ['admin', 'super_admin']);

    if (error || !admins || admins.length === 0) {
      console.warn('No admins found to notify:', error);
      return;
    }

    // Send email to each admin
    for (const admin of admins) {
      try {
        await emailService.sendAdminNewCampaignEmail(admin.email, {
          campaignName,
          campaignId,
          customerName,
          customerEmail
        });
        console.log(`✅ Admin notification sent to ${admin.email}`);
      } catch (emailError) {
        console.error(`Failed to send admin email to ${admin.email}:`, emailError);
        // Continue to next admin even if one fails
      }
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
    // Don't throw - we don't want to fail campaign creation if admin notification fails
  }
};

const OnboardingStep6 = () => {
  const navigate = useNavigate();
  const { user, checkOnboardingStatus } = useAuth();
  const [isLaunched, setIsLaunched] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [targetingData, setTargetingData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [campaignId, setCampaignId] = useState(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Load data from localStorage and sessionStorage
  useEffect(() => {
    const loadData = async () => {
      // Load selected template
      const savedTemplate = localStorage.getItem('selectedTemplate');
      if (savedTemplate) {
        setSelectedTemplate(JSON.parse(savedTemplate));
      }

      // Load targeting data (includes pricing)
      const savedTargeting = sessionStorage.getItem('targetingData');
      if (savedTargeting) {
        setTargetingData(JSON.parse(savedTargeting));
      }

      // Load company data and campaignId
      const savedCompanyData = localStorage.getItem('onboardingStep1');
      if (savedCompanyData) {
        const data = JSON.parse(savedCompanyData);
        setCompanyData(data);

        if (data.campaignId) {
          setCampaignId(data.campaignId);
          console.log('Loaded campaignId:', data.campaignId);
        } else {
          console.warn('No campaignId found in localStorage');
        }
      }

      // Check if user has payment methods
      try {
        const paymentMethods = await paymentService.getPaymentMethods();
        const hasPayment = paymentMethods && paymentMethods.length > 0;
        setHasPaymentMethod(hasPayment);
        console.log('Has payment method:', hasPayment);
      } catch (error) {
        console.error('Error checking payment methods:', error);
        setHasPaymentMethod(false);
      }
    };

    loadData();
  }, []);

  const steps = [
    { number: 1, title: 'Business URL', subtitle: 'Please provide email' },
    { number: 2, title: 'Select Postcard Template', subtitle: 'Setup your template' },
    { number: 3, title: 'Postcard Editor', subtitle: 'Customize your campaign' },
    { number: 4, title: 'Targeting & Budget', subtitle: 'Setup your business financial goals' },
    { number: 5, title: 'Payment Setup', subtitle: 'Provide payment flow' },
    { number: 6, title: 'Launch Campaign', subtitle: 'Finish your website setup' }
  ];

  const handleBack = () => {
    navigate('/onboarding/step5');
  };

  const handleActivate = async () => {
    if (!targetingData || !targetingData.zipsWithData || targetingData.zipsWithData === 0) {
      toast.error('No ZIP codes with data found. Please go back and validate ZIP codes.');
      return;
    }

    if (!campaignId) {
      toast.error('Campaign ID not found. Please restart onboarding.');
      return;
    }

    // Check if payment method exists
    if (!hasPaymentMethod) {
      toast.error('Please add a payment method to activate your campaign. You can add it in Settings → Billing after onboarding.');
      return;
    }

    setIsActivating(true);

    try {
      toast.loading('Activating your campaign...', { id: 'activate-campaign' });

      // Update campaign with targeting data and active status
      const campaignData = {
        campaign_name: `${companyData?.companyData?.name || 'Business'} Campaign`,
        status: 'active', // Set to active since payment exists
        targeting_type: targetingData.option || 'zip_codes',
        target_zip_codes: targetingData.zipCodes || [],
        new_mover_ids: targetingData.newMoverIds || [],
        total_recipients: targetingData.totalRecipients || 0,
        postcards_sent: 0,
        price_per_postcard: targetingData.flatRate || 3.00,
        payment_status: 'paid' // Mark as paid since payment method exists
      };

      const updateResult = await campaignService.updateCampaign(campaignId, campaignData);

      if (!updateResult.success) {
        throw new Error('Failed to update campaign');
      }

      console.log('Campaign activated:', updateResult.campaign);

      // Notify admins of new campaign
      await notifyAdminsOfNewCampaign(
        campaignData.campaign_name,
        campaignId,
        user?.name || user?.email || 'User',
        user?.email || 'Unknown'
      );

      // Mark onboarding as complete
      await onboardingService.completeOnboarding(campaignId);
      console.log('Onboarding marked as complete!');

      // Refresh onboarding status in context
      await checkOnboardingStatus();

      toast.success('Campaign activated! Your onboarding is complete!', { id: 'activate-campaign' });

      // Show success screen with manual button (user's preference)
      setIsLaunched(true);

      // Clear onboarding data from localStorage
      localStorage.removeItem('onboardingStep1');
      localStorage.removeItem('selectedTemplate');
      sessionStorage.removeItem('targetingData');

    } catch (error) {
      console.error('Error activating campaign:', error);
      toast.error(`Failed to activate campaign: ${error.error || error.message}`, {
        id: 'activate-campaign',
        duration: 5000
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handlePayLater = async () => {
    if (!targetingData || !targetingData.zipsWithData || targetingData.zipsWithData === 0) {
      toast.error('No ZIP codes with data found. Please go back and validate ZIP codes.');
      return;
    }

    if (!campaignId) {
      toast.error('Campaign ID not found. Please restart onboarding.');
      return;
    }

    try {
      toast.loading('Saving campaign as draft...', { id: 'pay-later' });

      // Update campaign with targeting data and draft status
      const campaignData = {
        campaign_name: `${companyData?.companyData?.name || 'Business'} Campaign`,
        status: 'draft', // Keep as draft until payment added
        targeting_type: targetingData.option || 'zip_codes',
        target_zip_codes: targetingData.zipCodes || [],
        new_mover_ids: targetingData.newMoverIds || [],
        total_recipients: targetingData.totalRecipients || 0,
        postcards_sent: 0,
        price_per_postcard: targetingData.flatRate || 3.00,
        payment_status: 'pending'
      };

      const result = await campaignService.updateCampaign(campaignId, campaignData);

      if (result.success) {
        // Notify admins of new campaign (even if draft)
        await notifyAdminsOfNewCampaign(
          campaignData.campaign_name,
          campaignId,
          user?.name || user?.email || 'User',
          user?.email || 'Unknown'
        );

        // Mark onboarding as complete even for draft campaigns
        await onboardingService.completeOnboarding(campaignId);
        console.log('Onboarding marked as complete (draft campaign)!');

        // Refresh onboarding status in context
        await checkOnboardingStatus();

        // Clear onboarding data from localStorage
        localStorage.removeItem('onboardingStep1');
        localStorage.removeItem('selectedTemplate');
        sessionStorage.removeItem('targetingData');

        toast.success('Campaign saved as draft! Add payment in Settings → Billing to activate.', { id: 'pay-later', duration: 4000 });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save campaign', { id: 'pay-later' });
    }
  };

  const handleGoToDashboard = () => {
    // Navigate to dashboard
    navigate('/dashboard');
  };

  if (isLaunched) {
    return (
      <OnboardingLayout
        steps={steps}
        currentStep={6}
        showFooter={false}
      >
        <div className="success-content">
          <h1 className="success-title">Campaign successfully launched!</h1>
          <button className="dashboard-button" onClick={handleGoToDashboard}>
            Go to Dashboard
          </button>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      steps={steps}
      currentStep={6}
      footerMessage={targetingData?.zipsWithData > 0
        ? `Your postcards will be sent to new movers in ${targetingData.zipsWithData} ZIP code${targetingData.zipsWithData !== 1 ? 's' : ''} at $${targetingData?.flatRate?.toFixed(2) || '3.00'} per postcard`
        : 'Ready to launch your campaign'}
      onContinue={handleActivate}
      continueText={isActivating ? 'Processing...' : 'Activate'}
      continueDisabled={isActivating}
      secondaryAction={handlePayLater}
      secondaryText="Pay Later"
      secondaryDisabled={isActivating}
    >
        <div className="main-content launch-content">
          <button className="back-button" onClick={handleBack}>
            <ChevronLeft size={18} />
            Back
          </button>
          
          <h1 className="main-title">Launch Campaign</h1>
          
          {/* Post Card Section */}
          <div className="launch-section">
            <h2 className="launch-section-title">Post Card</h2>
            <div className="postcard-final-preview">
              {selectedTemplate?.preview ? (
                <img
                  src={selectedTemplate.preview}
                  alt={`${selectedTemplate.name} template preview`}
                  className="postcard-preview-image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#718096',
                  fontSize: '1rem'
                }}>
                  No template preview available
                </div>
              )}
            </div>
          </div>

          {/* Package Section */}
          <div className="launch-section">
            <h2 className="launch-section-title">Package</h2>
            <div className="package-details">
              <div className="package-row">
                <div className="package-label">Template</div>
                <div className="package-value">{selectedTemplate?.name || 'Custom Template'}</div>
              </div>
              <div className="package-row">
                <div className="package-label">Business</div>
                <div className="package-value">{companyData?.companyData?.name || 'Your Business'}</div>
              </div>
              <div className="package-row">
                <div className="package-label">Targeting</div>
                <div className="package-value">
                  {targetingData?.totalZipCodes ? `${targetingData.totalZipCodes} ZIP Code${targetingData.totalZipCodes !== 1 ? 's' : ''}` : 'ZIP Code Targeting'}
                </div>
              </div>
              <div className="package-row">
                <div className="package-label">ZIP Codes with Data</div>
                <div className="package-value">{targetingData?.zipsWithData || 0} ZIP Code{targetingData?.zipsWithData !== 1 ? 's' : ''}</div>
              </div>
              <div className="package-row">
                <div className="package-label">Rate per Postcard</div>
                <div className="package-value package-price">${targetingData?.flatRate?.toFixed(2) || '3.00'}</div>
              </div>
            </div>
          </div>

          {/* Payment Warning */}
          {!hasPaymentMethod && (
            <div className="payment-warning-banner" style={{
              backgroundColor: '#FFF3CD',
              border: '1px solid #FFC107',
              borderRadius: '8px',
              padding: '16px',
              margin: '24px 0',
              display: 'flex',
              alignItems: 'start',
              gap: '12px'
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#856404' }}>
                  Payment Method Required
                </strong>
                <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                  Your campaign will remain inactive until you add a payment method.
                  You can add payment details in <strong>Settings → Billing</strong> after completing onboarding.
                </p>
              </div>
            </div>
          )}

          <div className="campaign-note">
            {targetingData?.zipsWithData > 0
              ? `Your postcards will be sent to new movers in ${targetingData.zipsWithData} ZIP code${targetingData.zipsWithData !== 1 ? 's' : ''} at $${targetingData?.flatRate?.toFixed(2) || '3.00'} per postcard`
              : 'No targeting data available'}
          </div>
        </div>

        <style>{`
          .package-breakdown {
            border-top: none !important;
            padding-top: 0 !important;
            margin-top: -8px;
          }

          .package-breakdown .package-value {
            font-size: 0.875rem;
            color: #718096;
            font-weight: normal;
          }

          .campaign-note {
            background: #E6FFFA;
            border-left: 4px solid #20B2AA;
            padding: 12px 16px;
            border-radius: 4px;
            color: #234E52;
            font-size: 0.875rem;
            margin-top: 16px;
          }
        `}</style>
    </OnboardingLayout>
  );
};

export default OnboardingStep6;