const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
// In your auth middleware
// In your auth middleware
const verifyToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  console.log('Auth header:', authHeader); // For debugging
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Bearer token missing.'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'No token provided'
    });
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded); // For debugging
    
    // Add userId to request object
    req.userId = decoded.id;
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token',
      error: error.message
    });
  }
};

/**
 * Error handler for async route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} - Express route handler with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  verifyToken,
  asyncHandler
};