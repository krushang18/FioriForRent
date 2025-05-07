const BaseController = require('./baseController');
const { QuotationTemplate, sequelize } = require('../models');
const { Op } = require('sequelize');

class QuotationTemplateController extends BaseController {
  constructor() {
    super(QuotationTemplate);
  }

  /**
   * Get all quotation templates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllTemplates = async (req, res) => {
    try {
      const templates = await QuotationTemplate.findAll({
        order: [
          ['is_default', 'DESC'],
          ['name', 'ASC']
        ]
      });
      
      res.status(200).json({
        status: 'success',
        data: templates
      });
    } catch (error) {
      console.error('Error in getAllTemplates:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch quotation templates',
        error: error.message
      });
    }
  };

  /**
   * Get default template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getDefaultTemplate = async (req, res) => {
    try {
      const template = await QuotationTemplate.findOne({
        where: { is_default: true }
      });
      
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: 'Default template not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: template
      });
    } catch (error) {
      console.error('Error in getDefaultTemplate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch default template',
        error: error.message
      });
    }
  };

  /**
   * Create a new template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createTemplate = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        name,
        is_default,
        header_content,
        body_content,
        footer_content,
        item_table_format,
        terms_format,
        css_styles
      } = req.body;
      
      // Validate required fields
      if (!name) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Template name is required'
        });
      }
      
      // If this template is set as default, update all others to non-default
      if (is_default) {
        await QuotationTemplate.update(
          { is_default: false },
          { where: {}, transaction }
        );
      }
      
      // Create the template
      const template = await QuotationTemplate.create({
        name,
        is_default: is_default || false,
        header_content,
        body_content,
        footer_content,
        item_table_format,
        terms_format,
        css_styles
      }, { transaction });
      
      await transaction.commit();
      
      res.status(201).json({
        status: 'success',
        message: 'Quotation template created successfully',
        data: template
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in createTemplate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create quotation template',
        error: error.message
      });
    }
  };

  /**
   * Update a template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateTemplate = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const {
        name,
        is_default,
        header_content,
        body_content,
        footer_content,
        item_table_format,
        terms_format,
        css_styles
      } = req.body;
      
      // Find the template
      const template = await QuotationTemplate.findByPk(id);
      
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Template not found'
        });
      }
      
      // If this template is set as default, update all others to non-default
      if (is_default) {
        await QuotationTemplate.update(
          { is_default: false },
          { 
            where: {
              id: { [Op.ne]: id }
            },
            transaction
          }
        );
      }
      
      // Update the template
      await template.update({
        name: name || template.name,
        is_default: is_default !== undefined ? is_default : template.is_default,
        header_content: header_content !== undefined ? header_content : template.header_content,
        body_content: body_content !== undefined ? body_content : template.body_content,
        footer_content: footer_content !== undefined ? footer_content : template.footer_content,
        item_table_format: item_table_format !== undefined ? item_table_format : template.item_table_format,
        terms_format: terms_format !== undefined ? terms_format : template.terms_format,
        css_styles: css_styles !== undefined ? css_styles : template.css_styles
      }, { transaction });
      
      await transaction.commit();
      
      res.status(200).json({
        status: 'success',
        message: 'Quotation template updated successfully',
        data: template
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in updateTemplate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update quotation template',
        error: error.message
      });
    }
  };

  /**
   * Delete a template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteTemplate = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the template
      const template = await QuotationTemplate.findByPk(id);
      
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Template not found'
        });
      }
      
      // Check if it's the default template
      if (template.is_default) {
        // Find another template to set as default
        const anotherTemplate = await QuotationTemplate.findOne({
          where: {
            id: { [Op.ne]: id }
          }
        });
        
        if (anotherTemplate) {
          await anotherTemplate.update({ is_default: true }, { transaction });
        } else {
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Cannot delete the only template in the system'
          });
        }
      }
      
      // Delete the template
      await template.destroy({ transaction });
      
      await transaction.commit();
      
      res.status(200).json({
        status: 'success',
        message: 'Quotation template deleted successfully'
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in deleteTemplate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete quotation template',
        error: error.message
      });
    }
  };

  /**
   * Set a template as default
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  setDefaultTemplate = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the template
      const template = await QuotationTemplate.findByPk(id);
      
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Template not found'
        });
      }
      
      // Update all templates to non-default
      await QuotationTemplate.update(
        { is_default: false },
        { 
          where: {},
          transaction
        }
      );
      
      // Set this template as default
      await template.update({ is_default: true }, { transaction });
      
      await transaction.commit();
      
      res.status(200).json({
        status: 'success',
        message: 'Template set as default successfully',
        data: template
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in setDefaultTemplate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to set template as default',
        error: error.message
      });
    }
  };
}

module.exports = new QuotationTemplateController();