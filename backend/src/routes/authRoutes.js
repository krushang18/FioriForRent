const express = require('express');
const authController = require('../controllers/authController');
const { asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/login', asyncHandler(authController.login));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Protected routes
router.post('/register', asyncHandler(authController.register));
router.get('/me', asyncHandler(authController.getCurrentUser));
router.post('/change-password', asyncHandler(authController.changePassword));

module.exports = router;