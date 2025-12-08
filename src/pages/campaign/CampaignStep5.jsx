import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProcessLayout from '../../components/process/ProcessLayout';
import { formatPrice } from '../../utils/pricing';
import campaignService from '../../supabase/api/campaignService';
import { paymentService } from '../../supabase/api/paymentService';
import toast from 'react-hot-toast';

const CampaignStep5 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLaunched, setIsLaunched] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [targetingData, setTargetingData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const totalSteps = 5;

  // Load data from localStorage and sessionStorage
  useEffect(() => {
    // Load selected template
    const savedTemplate = localStorage.getItem('campaignSelectedTemplate');
    if (savedTemplate) {
      setSelectedTemplate(JSON.parse(savedTemplate));
    }

    // Load targeting data
    const savedTargeting = sessionStorage.getItem('campaignTargetingData');
    if (savedTargeting) {
      setTargetingData(JSON.parse(savedTargeting));
    }

    // Load company data
    const savedCompanyData = localStorage.getItem('newCampaignData');
    if (savedCompanyData) {
      setCompanyData(JSON.parse(savedCompanyData));
    }

    // Load Cloudinary preview URL from Step 3
    const savedPreviewUrl = localStorage.getItem('campaignPreviewUrl');
    if (savedPreviewUrl) {
      setPreviewUrl(savedPreviewUrl);
      console.log('[Step 5] Using Cloudinary preview:', savedPreviewUrl);
    }
  }, []);

  const handleBack = () => {
    navigate('/campaign/step4');
  };

  const handleActivate = async () => {
    if (!targetingData || !targetingData.zipsWithData || targetingData.zipsWithData === 0) {
      toast.error('No ZIP codes with data found. Please go back and validate ZIP codes.');
      return;
    }

    setIsActivating(true);

    try {
      toast.loading('Activating your campaign...', { id: 'activate-campaign' });

      // Get campaign ID from Step 2
      const campaignId = localStorage.getItem('currentCampaignId');

      if (!campaignId) {
        throw new Error('Campaign ID not found. Please start from the beginning.');
      }

      // Get Cloudinary design URLs
      const designUrl = localStorage.getItem('campaignDesignUrl');
      const cloudinaryPreviewUrl = localStorage.getItem('campaignPreviewUrl');

      // Prepare campaign updates
      const campaignUpdates = {
        status: 'active',
        postcard_design_url: designUrl || null,
        postcard_preview_url: cloudinaryPreviewUrl || selectedTemplate?.preview || null,
        targeting_type: targetingData.option || 'zip_codes',
        target_zip_codes: targetingData.zipCodes || [],
        new_mover_ids: targetingData.newMoverIds || [],
        total_recipients: targetingData.totalRecipients || 0,
        postcards_sent: 0,
        price_per_postcard: targetingData.flatRate || 3.00,
        payment_status: 'pending',
        launched_at: new Date().toISOString(),
        // Enable polling for continuous new mover discovery
        polling_enabled: targetingData.pollingEnabled !== false, // Default true
        polling_frequency_hours: 0.5, // Poll every 30 minutes
        last_polled_at: null // Will be set on first poll
      };

      // Update existing draft campaign to active
      const campaignResult = await campaignService.updateCampaign(campaignId, campaignUpdates);

      if (!campaignResult.success) {
        throw new Error('Failed to activate campaign');
      }

      const campaign = campaignResult.campaign;
      console.log('Campaign activated:', campaign);

      toast.success('Campaign activated successfully!', { id: 'activate-campaign' });

      setIsLaunched(true);

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

    try {
      toast.loading('Saving campaign...', { id: 'pay-later' });

      // Get campaign ID from Step 2
      const campaignId = localStorage.getItem('currentCampaignId');

      if (!campaignId) {
        throw new Error('Campaign ID not found. Please start from the beginning.');
      }

      // Get Cloudinary design URLs
      const designUrl = localStorage.getItem('campaignDesignUrl');
      const cloudinaryPreviewUrl = localStorage.getItem('campaignPreviewUrl');

      // Update campaign with targeting data, keep draft status
      const campaignUpdates = {
        status: 'draft',
        postcard_design_url: designUrl || null,
        postcard_preview_url: cloudinaryPreviewUrl || selectedTemplate?.preview || null,
        targeting_type: targetingData.option || 'zip_codes',
        target_zip_codes: targetingData.zipCodes || [],
        new_mover_ids: targetingData.newMoverIds || [],
        total_recipients: targetingData.totalRecipients || 0,
        postcards_sent: 0,
        price_per_postcard: targetingData.flatRate || 3.00,
        payment_status: 'pending',
        // Enable polling for continuous new mover discovery (even for drafts)
        polling_enabled: targetingData.pollingEnabled !== false, // Default true
        polling_frequency_hours: 0.5, // Poll every 30 minutes
        last_polled_at: null // Will be set on first poll
      };

      const result = await campaignService.updateCampaign(campaignId, campaignUpdates);

      if (result.success) {
        toast.success('Campaign saved!', { id: 'pay-later' });
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
    navigate('/dashboard');
  };

  if (isLaunched) {
    return (
      <ProcessLayout currentStep={5} totalSteps={totalSteps} showFooter={false}>
        <div className="success-content">
          <motion.h1
            className="success-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Campaign successfully launched!
          </motion.h1>
          <motion.button
            className="dashboard-button"
            onClick={handleGoToDashboard}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.02, boxShadow: "0 8px 20px rgba(32, 178, 170, 0.3)" }}
            whileTap={{ scale: 0.98 }}
          >
            Go to Dashboard
          </motion.button>
        </div>
      </ProcessLayout>
    );
  }

  return (
    <ProcessLayout currentStep={5} totalSteps={totalSteps} showFooter={false}>
        <div className="main-content launch-content">
          <motion.button
            className="process-back-button"
            onClick={handleBack}
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <ChevronLeft size={18} />
            Back
          </motion.button>

          <h1 className="process-title">Launch Campaign</h1>

          {/* Post Card Section */}
          <div className="launch-section">
            <h2 className="launch-section-title">Post Card</h2>
            <div className="postcard-final-preview">
              {(previewUrl || selectedTemplate?.preview) ? (
                <img
                  src={previewUrl || selectedTemplate.preview}
                  alt={`${selectedTemplate?.name || 'Postcard'} preview`}
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
                  No postcard preview available
                </div>
              )}
            </div>
            {previewUrl && (
              <p style={{
                fontSize: '0.875rem',
                color: '#10b981',
                marginTop: '0.5rem',
                textAlign: 'center'
              }}>
                ✓ Showing your customized design
              </p>
            )}
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
                <div className="package-value">{companyData?.brandData?.name || 'Your Business'}</div>
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

          <div className="campaign-note">
            {targetingData?.zipsWithData > 0
              ? `Your postcards will be sent to new movers in ${targetingData.zipsWithData} ZIP code${targetingData.zipsWithData !== 1 ? 's' : ''} at $${targetingData?.flatRate?.toFixed(2) || '3.00'} per postcard`
              : 'No targeting data available'}
          </div>
        </div>

        <div className="form-footer">
          <div className="footer-actions" style={{width: '100%', justifyContent: 'space-between'}}>
            <span className="step-indicator">Step 5 of 5</span>
            <div className="final-actions">
              <motion.button
                className="pay-later-button"
                onClick={handlePayLater}
                disabled={isActivating}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Pay Later
              </motion.button>
              <motion.button
                className="activate-button"
                onClick={handleActivate}
                disabled={isActivating}
                whileHover={{ scale: 1.02, boxShadow: "0 8px 20px rgba(32, 178, 170, 0.25)" }}
                whileTap={{ scale: 0.98 }}
              >
                {isActivating ? 'Processing...' : 'Activate'}
              </motion.button>
            </div>
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

          .main-content {
            padding-bottom: 100px;
          }

          .postcard-final-preview {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px;
            background: #f7fafc;
            border-radius: 12px;
            min-height: 350px;
          }

          .postcard-preview-image {
            max-width: 100%;
            max-height: 500px;
            width: auto !important;
            height: auto !important;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          }

          .form-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            min-height: 72px;
            background-color: white;
            border-top: 1px solid #e2e8f0;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.03);
            z-index: 50;
            display: flex;
            align-items: center;
            padding: 1rem 2rem;
          }

          .footer-actions {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 1.5rem;
          }

          .step-indicator {
            font-size: 0.875rem;
            font-weight: 600;
            color: #4a5568;
          }

          .final-actions {
            display: flex;
            gap: 0.75rem;
            align-items: center;
          }

          @media (max-width: 768px) {
            .form-footer {
              padding: 0.875rem 1rem;
            }

            .footer-actions {
              flex-direction: column;
              gap: 0.875rem;
              align-items: flex-start;
            }

            .step-indicator {
              font-size: 0.8125rem;
            }

            .final-actions {
              width: 100%;
              justify-content: flex-end;
            }

            .pay-later-button,
            .pay-activate-button {
              flex: 1;
            }
          }
        `}</style>
    </ProcessLayout>
  );
};

export default CampaignStep5;
