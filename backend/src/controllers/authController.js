const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');

class AuthController {
  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  register = async (req, res) => {
    try {
      // Check if registration is disabled
      if (process.env.ALLOW_REGISTRATION !== 'true') {
        return res.status(403).json({
          status: 'error',
          message: 'Registration is currently disabled'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { 
          [Op.or]: [
            { username: req.body.username },
            { email: req.body.email }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Username or email already in use'
        });
      }

      // Create new user
      const user = await User.create({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        phone_numbers: req.body.phone_numbers
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );

      // Remove password from response
      const userResponse = { ...user.get() };
      delete userResponse.password;

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: userResponse,
          token
        }
      });
    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to register user',
        error: error.message
      });
    }
  };

  /**
   * Login a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  login = async (req, res) => {
    try {
      // Find user by username
      const user = await User.findOne({
        where: { username: req.body.username }
      });

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid username or password'
        });
      }

      // Validate password
      const isPasswordValid = await user.validatePassword(req.body.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid username or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );

      // Remove password from response
      const userResponse = { ...user.get() };
      delete userResponse.password;

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: userResponse,
          token
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to login',
        error: error.message
      });
    }
  };

  /**
   * Get current user info
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCurrentUser = async (req, res) => {
    try {      
      const user = await User.findByPk(req.userId);
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Remove password from response
      const userResponse = { ...user.get() };
      delete userResponse.password;

      res.status(200).json({
        status: 'success',
        data: userResponse
      });
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user information',
        error: error.message
      });
    }
  };

  /**
   * Change password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  changePassword = async (req, res) => {
    try {
      const user = await User.findByPk(req.userId);
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Validate current password
      const isPasswordValid = await user.validatePassword(req.body.currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = req.body.newPassword;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Error in changePassword:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to change password',
        error: error.message
      });
    }
  };

  /**
   * Forgot password - send reset email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  forgotPassword = async (req, res) => {
    try {
      const user = await User.findOne({
        where: { email: req.body.email }
      });

      if (!user) {
        // For security reasons, don't reveal if email exists or not
        return res.status(200).json({
          status: 'success',
          message: 'If your email is registered, you will receive a password reset link'
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user.id },
        process.env.JWT_RESET_SECRET,
        { expiresIn: '1h' }
      );

      // TODO: Send password reset email using email service
      // This would be implemented in a real application

      res.status(200).json({
        status: 'success',
        message: 'If your email is registered, you will receive a password reset link'
      });
    } catch (error) {
      console.error('Error in forgotPassword:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process password reset request',
        error: error.message
      });
    }
  };

  /**
   * Reset password using token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  resetPassword = async (req, res) => {
    try {
      // Verify reset token
      const decoded = jwt.verify(req.body.token, process.env.JWT_RESET_SECRET);
      
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Invalid or expired reset token'
        });
      }

      // Update password
      user.password = req.body.newPassword;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Error in resetPassword:', error);
      res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token',
        error: error.message
      });
    }
  };
}

module.exports = new AuthController();