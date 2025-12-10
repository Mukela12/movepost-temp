import { supabase } from '../integration/client';

/**
 * Email Service - Handles all email notifications via Supabase Edge Function + Resend
 */

const EMAIL_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174';

/**
 * Send email via Supabase Edge Function
 */
const sendEmail = async (to, subject, html, options = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(EMAIL_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        from: options.from,
        replyTo: options.replyTo,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    console.log('Email sent successfully:', result);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get base email template with MovePost branding
 */
const getEmailTemplate = (content, cardColor = '#20B2AA') => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MovePost</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f7fafc;
      color: #2d3748;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .email-header {
      text-align: center;
      padding: 30px 20px;
      background: white;
      border-radius: 12px 12px 0 0;
      border-bottom: 2px solid #e2e8f0;
    }
    .logo {
      max-width: 120px;
      height: auto;
    }
    .email-content {
      background: white;
      padding: 40px 30px;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .card {
      background: white;
      border: 2px solid ${cardColor};
      border-radius: 12px;
      padding: 30px;
      margin: 20px 0;
    }
    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: ${cardColor}15;
      color: ${cardColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 24px;
    }
    h1 {
      color: #1a202c;
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 20px 0;
      line-height: 1.3;
    }
    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 28px;
      background: ${cardColor};
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: all 0.2s ease;
    }
    .cta-button:hover {
      background: ${cardColor}dd;
    }
    .footer {
      text-align: center;
      padding: 30px 20px;
      color: #a0aec0;
      font-size: 14px;
    }
    .footer a {
      color: #20B2AA;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <img src="https://res.cloudinary.com/dgdbxflan/image/upload/v1765382738/movepost-logo_betrhl.avif" alt="MovePost" class="logo" />
    </div>
    <div class="email-content">
      ${content}

      <div class="divider"></div>

      <p style="font-size: 14px; color: #718096;">
        If you have any questions, please contact us at
        <a href="mailto:support@movepost.com" style="color: #20B2AA;">support@movepost.com</a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MovePost. All rights reserved.</p>
      <p>
        <a href="${FRONTEND_URL}/dashboard">Dashboard</a> •
        <a href="${FRONTEND_URL}/settings">Settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Campaign Approved Email
 */
export const sendCampaignApprovedEmail = async (userEmail, campaignData) => {
  const content = `
    <div class="card">
      <div class="card-icon">✓</div>
      <h1>🎉 Your Campaign is Live!</h1>
      <p>Great news! Your campaign "<strong>${campaignData.campaignName}</strong>" has been approved and is now active.</p>
      <p>We'll start monitoring for new movers in your target area and automatically send postcards to matching homeowners.</p>
      <p><strong>Campaign Details:</strong></p>
      <ul style="color: #4a5568; line-height: 1.8;">
        <li>Approved: ${new Date(campaignData.approvedAt).toLocaleDateString()}</li>
        <li>Status: Active</li>
        <li>Polling: Enabled</li>
      </ul>
      <a href="${FRONTEND_URL}/campaigns/${campaignData.campaignId}" class="cta-button">View Campaign Dashboard</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    '🎉 Your MovePost Campaign is Live!',
    getEmailTemplate(content, '#10B981')
  );
};

/**
 * Campaign Rejected Email
 */
export const sendCampaignRejectedEmail = async (userEmail, campaignData) => {
  const content = `
    <div class="card">
      <div class="card-icon">⚠</div>
      <h1>Action Required: Campaign Needs Updates</h1>
      <p>Your campaign "<strong>${campaignData.campaignName}</strong>" requires some updates before we can approve it.</p>
      <p><strong>Reason:</strong></p>
      <p style="background: #FEF2F2; padding: 15px; border-radius: 8px; border-left: 4px solid #EF4444;">
        ${campaignData.rejectionReason}
      </p>
      <p>Please review the feedback and update your campaign. Once you've made the necessary changes, we'll review it again promptly.</p>
      <a href="${FRONTEND_URL}/campaigns/${campaignData.campaignId}/edit" class="cta-button">Edit Campaign</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Action Required: Campaign Needs Updates',
    getEmailTemplate(content, '#F59E0B')
  );
};

/**
 * Campaign Paused Email
 */
export const sendCampaignPausedEmail = async (userEmail, campaignData) => {
  const content = `
    <div class="card">
      <div class="card-icon">⏸</div>
      <h1>Your Campaign Has Been Paused</h1>
      <p>We've paused your campaign "<strong>${campaignData.campaignName}</strong>".</p>
      <p><strong>Reason:</strong></p>
      <p style="background: #FFFBEB; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;">
        ${campaignData.pauseReason}
      </p>
      <p>No new postcards will be sent until the campaign is resumed. If you have any questions, please don't hesitate to contact our support team.</p>
      <a href="${FRONTEND_URL}/contact" class="cta-button">Contact Support</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Your Campaign Has Been Paused',
    getEmailTemplate(content, '#F59E0B')
  );
};

/**
 * Campaign Resumed Email
 */
export const sendCampaignResumedEmail = async (userEmail, campaignData) => {
  const content = `
    <div class="card">
      <div class="card-icon">▶</div>
      <h1>Your Campaign is Active Again</h1>
      <p>Good news! Your campaign "<strong>${campaignData.campaignName}</strong>" has been resumed and is now active.</p>
      <p>We've restarted monitoring for new movers and will continue sending postcards to matching homeowners in your target area.</p>
      <a href="${FRONTEND_URL}/campaigns/${campaignData.campaignId}" class="cta-button">View Campaign</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Your Campaign is Active Again',
    getEmailTemplate(content, '#0EA5E9')
  );
};

/**
 * User Blocked Email
 */
export const sendUserBlockedEmail = async (userEmail, blockData) => {
  const content = `
    <div class="card">
      <div class="card-icon">🔒</div>
      <h1>Account Access Restricted</h1>
      <p>Your MovePost account has been temporarily restricted.</p>
      <p><strong>Reason:</strong></p>
      <p style="background: #FEF2F2; padding: 15px; border-radius: 8px; border-left: 4px solid #EF4444;">
        ${blockData.blockReason}
      </p>
      <p>If you believe this is an error or would like to appeal this decision, please contact our support team. We're here to help resolve any issues.</p>
      <a href="mailto:support@movepost.com?subject=Account Restriction Appeal" class="cta-button">Contact Support</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Account Access Restricted',
    getEmailTemplate(content, '#EF4444')
  );
};

/**
 * User Unblocked Email
 */
export const sendUserUnblockedEmail = async (userEmail) => {
  const content = `
    <div class="card">
      <div class="card-icon">🔓</div>
      <h1>Welcome Back! Your Account is Restored</h1>
      <p>Great news! Your MovePost account has been restored and you now have full access again.</p>
      <p>You can log in to your account and continue managing your campaigns as usual. Thank you for your patience.</p>
      <a href="${FRONTEND_URL}/login" class="cta-button">Login to Dashboard</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Welcome Back! Your Account is Restored',
    getEmailTemplate(content, '#10B981')
  );
};

/**
 * Payment Failed Email
 */
export const sendPaymentFailedEmail = async (userEmail, paymentData) => {
  const content = `
    <div class="card">
      <div class="card-icon">💳</div>
      <h1>⚠️ Payment Failed - Action Required</h1>
      <p>We were unable to process your payment for your MovePost campaign.</p>
      <p><strong>Details:</strong></p>
      <ul style="color: #4a5568; line-height: 1.8;">
        <li>Amount: $${paymentData.amount?.toFixed(2)}</li>
        <li>Reason: ${paymentData.failureReason}</li>
        <li>Date: ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>Please update your payment method to continue your campaign. Your postcards will resume automatically once payment is successful.</p>
      <a href="${FRONTEND_URL}/settings/billing" class="cta-button">Update Payment Method</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    '⚠️ Payment Failed - Action Required',
    getEmailTemplate(content, '#EF4444')
  );
};

/**
 * Payment Requires 3D Secure Email
 */
export const sendPaymentRequiresActionEmail = async (userEmail, paymentData) => {
  const content = `
    <div class="card">
      <div class="card-icon">🔐</div>
      <h1>Complete Payment Authentication</h1>
      <p>Your payment requires additional authentication to complete.</p>
      <p>Please click the button below to complete the 3D Secure verification with your bank. This is a security measure to protect your account.</p>
      <p><strong>Amount:</strong> $${paymentData.amount?.toFixed(2)}</p>
      <a href="${paymentData.authenticationUrl}" class="cta-button">Complete Authentication</a>
    </div>
  `;

  return await sendEmail(
    userEmail,
    'Complete Payment Authentication',
    getEmailTemplate(content, '#F59E0B')
  );
};

/**
 * Admin - New Campaign Submitted
 */
export const sendAdminNewCampaignEmail = async (adminEmail, campaignData) => {
  const content = `
    <div class="card">
      <div class="card-icon">📋</div>
      <h1>New Campaign Awaiting Review</h1>
      <p>A new campaign has been submitted and requires your review.</p>
      <p><strong>Campaign Details:</strong></p>
      <ul style="color: #4a5568; line-height: 1.8;">
        <li>Campaign: ${campaignData.campaignName}</li>
        <li>Customer: ${campaignData.customerName} (${campaignData.customerEmail})</li>
        <li>Submitted: ${new Date(campaignData.createdAt).toLocaleString()}</li>
      </ul>
      <a href="${FRONTEND_URL}/admin/campaigns/${campaignData.campaignId}" class="cta-button">Review Campaign</a>
    </div>
  `;

  return await sendEmail(
    adminEmail,
    '📋 New Campaign Awaiting Review',
    getEmailTemplate(content, '#20B2AA')
  );
};

/**
 * Admin - Payment Issue Alert
 */
export const sendAdminPaymentIssueEmail = async (adminEmail, issueData) => {
  const content = `
    <div class="card">
      <div class="card-icon">⚠</div>
      <h1>Customer Payment Issue</h1>
      <p>A customer is experiencing payment issues that may require attention.</p>
      <p><strong>Details:</strong></p>
      <ul style="color: #4a5568; line-height: 1.8;">
        <li>Customer: ${issueData.customerName} (${issueData.customerEmail})</li>
        <li>Amount: $${issueData.amount?.toFixed(2)}</li>
        <li>Failure Reason: ${issueData.failureReason}</li>
        <li>Date: ${new Date().toLocaleString()}</li>
      </ul>
      <a href="${FRONTEND_URL}/admin/users/${issueData.userId}" class="cta-button">View Customer Account</a>
    </div>
  `;

  return await sendEmail(
    adminEmail,
    '⚠️ Customer Payment Issue',
    getEmailTemplate(content, '#F59E0B')
  );
};

export default {
  sendCampaignApprovedEmail,
  sendCampaignRejectedEmail,
  sendCampaignPausedEmail,
  sendCampaignResumedEmail,
  sendUserBlockedEmail,
  sendUserUnblockedEmail,
  sendPaymentFailedEmail,
  sendPaymentRequiresActionEmail,
  sendAdminNewCampaignEmail,
  sendAdminPaymentIssueEmail,
};
