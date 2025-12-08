/**
 * PostGrid API Service
 * Handles sending postcards via PostGrid API
 * Documentation: https://postgrid.readme.io/docs/sending-postcards-using-the-api
 */

const POSTGRID_API_URL = import.meta.env.VITE_POSTGRID_API_URL || 'https://api.postgrid.com/print-mail/v1';
const POSTGRID_API_KEY = import.meta.env.VITE_POSTGRID_API_KEY;

/**
 * PostGrid service for managing postcard creation and delivery
 */
export const postgridService = {
  /**
   * Send a postcard to a new mover via PostGrid API
   * @param {Object} recipient - New mover recipient data
   * @param {string} recipient.full_name - Full name of recipient
   * @param {string} recipient.address_line - Street address
   * @param {string} recipient.city - City
   * @param {string} recipient.state - State/Province
   * @param {string} recipient.zip_code - ZIP/Postal code
   * @param {string} designUrl - URL of the postcard design (PDF from Cloudinary)
   * @param {Object} campaign - Campaign metadata
   * @param {string} campaign.id - Campaign ID
   * @param {string} campaign.campaign_name - Campaign name
   * @param {string} campaign.user_id - User ID
   * @returns {Promise<Object>} PostGrid postcard response
   */
  async sendPostcard(recipient, designUrl, campaign = {}) {
    if (!POSTGRID_API_KEY) {
      throw new Error('PostGrid API key not configured. Please set VITE_POSTGRID_API_KEY in .env');
    }

    // Parse full name into first/last name
    const nameParts = (recipient.full_name || '').trim().split(' ');
    const firstName = nameParts[0] || 'Resident';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare recipient contact object
    const toContact = {
      firstName: firstName,
      lastName: lastName,
      addressLine1: recipient.address_line,
      city: recipient.city,
      provinceOrState: recipient.state,
      postalOrZip: recipient.zip_code,
      countryCode: 'US', // Default to US, can be made configurable
    };

    // Add phone/email if available
    if (recipient.phone_number) {
      toContact.phoneNumber = recipient.phone_number;
    }

    // Prepare request body
    const requestBody = {
      to: toContact,
      // Note: 'from' address should be configured in PostGrid dashboard
      // or passed from campaign settings
      size: '6x4', // Standard postcard size (can be made configurable)
      pdf: designUrl, // Use the Cloudinary design URL
      description: campaign.campaign_name || 'New Mover Campaign',
      express: false, // Standard delivery (can be made configurable)
      metadata: {
        campaign_id: campaign.id,
        user_id: campaign.user_id,
        new_mover_id: recipient.id,
        melissa_address_key: recipient.melissa_address_key,
        move_effective_date: recipient.move_effective_date,
      },
    };

    try {
      const response = await fetch(`${POSTGRID_API_URL}/postcards`, {
        method: 'POST',
        headers: {
          'x-api-key': POSTGRID_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `PostGrid API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const postcardData = await response.json();

      return {
        success: true,
        postcardId: postcardData.id,
        status: postcardData.status,
        url: postcardData.url, // Preview URL
        sendDate: postcardData.sendDate,
        live: postcardData.live, // false for test mode
        data: postcardData,
      };
    } catch (error) {
      console.error('PostGrid sendPostcard error:', error);
      throw new Error(`Failed to send postcard via PostGrid: ${error.message}`);
    }
  },

  /**
   * Get the status of a postcard
   * @param {string} postcardId - PostGrid postcard ID
   * @returns {Promise<Object>} Postcard status data
   */
  async getPostcardStatus(postcardId) {
    if (!POSTGRID_API_KEY) {
      throw new Error('PostGrid API key not configured');
    }

    try {
      const response = await fetch(`${POSTGRID_API_URL}/postcards/${postcardId}`, {
        method: 'GET',
        headers: {
          'x-api-key': POSTGRID_API_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `PostGrid API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const postcardData = await response.json();

      return {
        success: true,
        status: postcardData.status,
        sendDate: postcardData.sendDate,
        url: postcardData.url,
        data: postcardData,
      };
    } catch (error) {
      console.error('PostGrid getPostcardStatus error:', error);
      throw new Error(`Failed to get postcard status: ${error.message}`);
    }
  },

  /**
   * Cancel a postcard (only works if not yet printed)
   * @param {string} postcardId - PostGrid postcard ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPostcard(postcardId) {
    if (!POSTGRID_API_KEY) {
      throw new Error('PostGrid API key not configured');
    }

    try {
      const response = await fetch(`${POSTGRID_API_URL}/postcards/${postcardId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': POSTGRID_API_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `PostGrid API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const result = await response.json();

      return {
        success: true,
        deleted: result.deleted,
        data: result,
      };
    } catch (error) {
      console.error('PostGrid cancelPostcard error:', error);
      throw new Error(`Failed to cancel postcard: ${error.message}`);
    }
  },

  /**
   * List postcards with pagination
   * @param {Object} options - Query options
   * @param {string} options.search - Search term
   * @param {number} options.skip - Number of records to skip
   * @param {number} options.limit - Maximum number of records to return
   * @returns {Promise<Object>} List of postcards
   */
  async listPostcards({ search = '', skip = 0, limit = 10 } = {}) {
    if (!POSTGRID_API_KEY) {
      throw new Error('PostGrid API key not configured');
    }

    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`${POSTGRID_API_URL}/postcards?${params}`, {
        method: 'GET',
        headers: {
          'x-api-key': POSTGRID_API_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `PostGrid API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      return {
        success: true,
        postcards: data.data || [],
        totalCount: data.totalCount || 0,
        data: data,
      };
    } catch (error) {
      console.error('PostGrid listPostcards error:', error);
      throw new Error(`Failed to list postcards: ${error.message}`);
    }
  },

  /**
   * Progress a test postcard through status stages (TEST MODE ONLY)
   * Useful for testing delivery workflows without actual mail
   * @param {string} postcardId - PostGrid postcard ID
   * @returns {Promise<Object>} Progression result
   */
  async progressTestPostcard(postcardId) {
    if (!POSTGRID_API_KEY) {
      throw new Error('PostGrid API key not configured');
    }

    // Only works in test mode
    if (!POSTGRID_API_KEY.startsWith('test_')) {
      throw new Error('Progression only works with test mode API keys');
    }

    try {
      const response = await fetch(
        `${POSTGRID_API_URL}/postcards/${postcardId}/progressions`,
        {
          method: 'POST',
          headers: {
            'x-api-key': POSTGRID_API_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `PostGrid API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const result = await response.json();

      return {
        success: true,
        status: result.status,
        data: result,
      };
    } catch (error) {
      console.error('PostGrid progressTestPostcard error:', error);
      throw new Error(`Failed to progress test postcard: ${error.message}`);
    }
  },

  /**
   * Validate PostGrid configuration
   * @returns {Promise<boolean>} True if configured correctly
   */
  async validateConfiguration() {
    if (!POSTGRID_API_KEY) {
      return {
        valid: false,
        error: 'PostGrid API key not configured',
      };
    }

    try {
      // Try to list postcards to validate API key
      const response = await fetch(`${POSTGRID_API_URL}/postcards?limit=1`, {
        method: 'GET',
        headers: {
          'x-api-key': POSTGRID_API_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          valid: false,
          error: errorData.error?.message || 'Invalid API key',
        };
      }

      return {
        valid: true,
        mode: POSTGRID_API_KEY.startsWith('test_') ? 'test' : 'live',
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  },
};
