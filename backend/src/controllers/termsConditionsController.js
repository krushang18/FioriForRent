const BaseController = require('./baseController');
const { TermsConditions } = require('../models');
const { Op } = require('sequelize');

class TermsConditionsController extends BaseController {
  constructor() {
    super(TermsConditions);
  }

  /**
   * Get all terms and conditions with optional filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllTerms = async (req, res) => {
    try {
      const { category, is_default, search } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      
      if (category) {
        whereConditions.category = category;
      }
      
      if (is_default !== undefined) {
        whereConditions.is_default = is_default === 'true';
      }
      
      if (search) {
        whereConditions[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }
      
      const terms = await TermsConditions.findAll({
        where: whereConditions,
        order: [
          ['display_order', 'ASC'],
          ['title', 'ASC']
        ]
      });
      
      res.status(200).json({
        status: 'success',
        data: terms
      });
    } catch (error) {
      console.error('Error in getAllTerms:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch terms and conditions',
        error: error.message
      });
    }
  };

  /**
   * Create a new terms and conditions item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createTerm = async (req, res) => {
    try {
      const { title, description, category, is_default, display_order } = req.body;
      
      // Validate required fields
      if (!title || !description) {
        return res.status(400).json({
          status: 'error',
          message: 'Title and description are required'
        });
      }
      
      // Create the terms and conditions item
      const term = await TermsConditions.create({
        title,
        description,
        category: category || null,
        is_default: is_default === true,
        display_order: display_order || null
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Terms and conditions item created successfully',
        data: term
      });
    } catch (error) {
      console.error('Error in createTerm:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create terms and conditions item',
        error: error.message
      });
    }
  };

  /**
   * Update a terms and conditions item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateTerm = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, category, is_default, display_order } = req.body;
      
      // Find the term
      const term = await TermsConditions.findByPk(id);
      
      if (!term) {
        return res.status(404).json({
          status: 'error',
          message: 'Terms and conditions item not found'
        });
      }
      
      // Update the term
      await term.update({
        title: title || term.title,
        description: description || term.description,
        category: category !== undefined ? category : term.category,
        is_default: is_default !== undefined ? is_default : term.is_default,
        display_order: display_order !== undefined ? display_order : term.display_order
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Terms and conditions item updated successfully',
        data: term
      });
    } catch (error) {
      console.error('Error in updateTerm:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update terms and conditions item',
        error: error.message
      });
    }
  };

  /**
   * Delete a terms and conditions item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteTerm = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the term
      const term = await TermsConditions.findByPk(id);
      
      if (!term) {
        return res.status(404).json({
          status: 'error',
          message: 'Terms and conditions item not found'
        });
      }
      
      // Delete the term
      await term.destroy();
      
      res.status(200).json({
        status: 'success',
        message: 'Terms and conditions item deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteTerm:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete terms and conditions item',
        error: error.message
      });
    }
  };

  /**
   * Update display order of multiple terms
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateOrder = async (req, res) => {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request format. Expected an array of items'
        });
      }
      
      // Update each item's display order
      const updatePromises = items.map(item => 
        TermsConditions.update(
          { display_order: item.display_order },
          { where: { id: item.id } }
        )
      );
      
      await Promise.all(updatePromises);
      
      // Fetch the updated terms
      const updatedTerms = await TermsConditions.findAll({
        order: [
          ['display_order', 'ASC'],
          ['title', 'ASC']
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Display order updated successfully',
        data: updatedTerms
      });
    } catch (error) {
      console.error('Error in updateOrder:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update display order',
        error: error.message
      });
    }
  };

  /**
   * Get all categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCategories = async (req, res) => {
    try {
      // Find all unique categories
      const result = await TermsConditions.findAll({
        attributes: ['category'],
        where: {
          category: {
            [Op.ne]: null
          }
        },
        group: ['category']
      });
      
      const categories = result.map(item => item.category).filter(Boolean);
      
      res.status(200).json({
        status: 'success',
        data: categories
      });
    } catch (error) {
      console.error('Error in getCategories:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  };
}

module.exports = new TermsConditionsController();