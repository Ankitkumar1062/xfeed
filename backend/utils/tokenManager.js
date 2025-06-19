/**
 * Check if a token has a valid format
 * @param {string} token - The token to check
 * @returns {boolean} Whether the token has a valid format
 */
exports.isValidTokenFormat = (token) => {
  try {
    // Try to parse the token as JSON if it's a string
    const parsedToken = typeof token === 'string' ? JSON.parse(token) : token;
    
    // Check if it has the expected structure
    if (typeof parsedToken !== 'object' || parsedToken === null) {
      console.log('Token is not an object');
      return false;
    }
    
    // Check for essential cookie properties - as of 2025, these are still required
    if (!parsedToken.auth_token || !parsedToken.ct0) {
      console.log('Token is missing required properties');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating token format:', error.message);
    return false;
  }
};
