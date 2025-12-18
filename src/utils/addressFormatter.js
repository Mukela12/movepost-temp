/**
 * Address Formatting Utilities
 * Handles parsing and formatting of address data
 */

/**
 * Parse address from various formats (JSON string, object, or plain string)
 * @param {string|object} address - Address data in any format
 * @returns {object|string} Parsed address object or original string
 */
export const parseAddress = (address) => {
  if (!address) return null;

  // If it's already an object, return it
  if (typeof address === 'object') {
    return address;
  }

  // If it's a string, try to parse as JSON
  if (typeof address === 'string') {
    // Try to parse JSON
    try {
      const parsed = JSON.parse(address);
      if (typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {
      // Not JSON, return as plain string
      return address;
    }
  }

  return address;
};

/**
 * Format address object or string into a readable single line
 * @param {string|object} address - Address data
 * @returns {string} Formatted address string
 */
export const formatAddress = (address) => {
  if (!address) return '';

  const parsed = parseAddress(address);

  // If it's a plain string (already formatted), return it
  if (typeof parsed === 'string') {
    return parsed;
  }

  // If it's an object, format it nicely
  if (typeof parsed === 'object') {
    const parts = [];

    // Add street if exists
    if (parsed.street || parsed.streetAddress) {
      parts.push(parsed.street || parsed.streetAddress);
    }

    // Add city
    if (parsed.city) {
      parts.push(parsed.city);
    }

    // Add state/province
    if (parsed.state || parsed.province) {
      parts.push(parsed.state || parsed.province);
    }

    // Add postal/zip code
    if (parsed.postalCode || parsed.zipCode || parsed.zip) {
      parts.push(parsed.postalCode || parsed.zipCode || parsed.zip);
    }

    // Add country
    if (parsed.country) {
      parts.push(parsed.country);
    }

    return parts.filter(Boolean).join(', ');
  }

  return '';
};

/**
 * Format address object into multiple lines for display
 * @param {string|object} address - Address data
 * @returns {string} Formatted multi-line address
 */
export const formatAddressMultiLine = (address) => {
  if (!address) return '';

  const parsed = parseAddress(address);

  // If it's a plain string, return it
  if (typeof parsed === 'string') {
    return parsed;
  }

  // If it's an object, format it with line breaks
  if (typeof parsed === 'object') {
    const lines = [];

    // Line 1: Street address
    if (parsed.street || parsed.streetAddress) {
      lines.push(parsed.street || parsed.streetAddress);
    }

    // Line 2: City, State Zip
    const cityStateLine = [];
    if (parsed.city) cityStateLine.push(parsed.city);
    if (parsed.state || parsed.province) {
      cityStateLine.push(parsed.state || parsed.province);
    }
    if (parsed.postalCode || parsed.zipCode || parsed.zip) {
      cityStateLine.push(parsed.postalCode || parsed.zipCode || parsed.zip);
    }
    if (cityStateLine.length > 0) {
      lines.push(cityStateLine.join(', '));
    }

    // Line 3: Country
    if (parsed.country) {
      lines.push(parsed.country);
    }

    return lines.filter(Boolean).join('\n');
  }

  return '';
};

/**
 * Get short address (City, State, Country)
 * @param {string|object} address - Address data
 * @returns {string} Short formatted address
 */
export const formatAddressShort = (address) => {
  if (!address) return '';

  const parsed = parseAddress(address);

  // If it's a plain string, return it
  if (typeof parsed === 'string') {
    return parsed;
  }

  // If it's an object, format short version
  if (typeof parsed === 'object') {
    const parts = [];

    if (parsed.city) parts.push(parsed.city);
    if (parsed.state || parsed.province) {
      parts.push(parsed.state || parsed.province);
    }
    if (parsed.country) parts.push(parsed.country);

    return parts.filter(Boolean).join(', ');
  }

  return '';
};

export default {
  parseAddress,
  formatAddress,
  formatAddressMultiLine,
  formatAddressShort,
};
