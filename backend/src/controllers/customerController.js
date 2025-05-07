const BaseController = require('./baseController');
const { Customer, Quotation } = require('../models');
const { Op } = require('sequelize');

class CustomerController extends BaseController {
  constructor() {
    super(Customer);
  }

  /**
   * Get all customers with optional search
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllCustomers = async (req, res) => {
    try {
      const { search } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      
      if (search) {
        whereConditions[Op.or] = [
          { company_name: { [Op.like]: `%${search}%` } },
          { contact_person: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { address: { [Op.like]: `%${search}%` } },
          { site_location: { [Op.like]: `%${search}%` } },
          { gst_number: { [Op.like]: `%${search}%` } }
        ];
      }
      
      const customers = await Customer.findAll({
        where: whereConditions,
        order: [['company_name', 'ASC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: customers
      });
    } catch (error) {
      console.error('Error in getAllCustomers:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customers',
        error: error.message
      });
    }
  };

  /**
   * Get a customer by ID with their quotation history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCustomerWithHistory = async (req, res) => {
    try {
      const { id } = req.params;
      
      const customer = await Customer.findByPk(id);
      
      if (!customer) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: customer
      });
    } catch (error) {
      console.error('Error in getCustomerWithHistory:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customer details',
        error: error.message
      });
    }
  };

  /**
   * Create a new customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createCustomer = async (req, res) => {
    try {
      const {
        company_name,
        contact_person,
        email,
        phone,
        address,
        site_location,
        gst_number
      } = req.body;
      
      // Validate required fields
      if (!company_name || !phone) {
        return res.status(400).json({
          status: 'error',
          message: 'Company name and phone are required'
        });
      }
      
      // Check if customer already exists with same company name
      const existingCustomer = await Customer.findOne({
        where: { company_name: company_name }
      });
      
      if (existingCustomer) {
        return res.status(400).json({
          status: 'error',
          message: 'A customer with this company name already exists'
        });
      }
      
      // Create the customer
      const customer = await Customer.create({
        company_name,
        contact_person,
        email,
        phone,
        address,
        site_location,
        gst_number
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Customer created successfully',
        data: customer
      });
    } catch (error) {
      console.error('Error in createCustomer:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create customer',
        error: error.message
      });
    }
  };

  /**
   * Update a customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateCustomer = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        company_name,
        contact_person,
        email,
        phone,
        address,
        site_location,
        gst_number
      } = req.body;
      
      // Find the customer
      const customer = await Customer.findByPk(id);
      
      if (!customer) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found'
        });
      }
      
      // Check if company name is being changed and already exists
      if (company_name && company_name !== customer.company_name) {
        const existingCustomer = await Customer.findOne({
          where: {
            company_name: company_name,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingCustomer) {
          return res.status(400).json({
            status: 'error',
            message: 'A customer with this company name already exists'
          });
        }
      }
      
      // Update the customer
      await customer.update({
        company_name: company_name || customer.company_name,
        contact_person: contact_person !== undefined ? contact_person : customer.contact_person,
        email: email !== undefined ? email : customer.email,
        phone: phone || customer.phone,
        address: address !== undefined ? address : customer.address,
        site_location: site_location !== undefined ? site_location : customer.site_location,
        gst_number: gst_number !== undefined ? gst_number : customer.gst_number
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Customer updated successfully',
        data: customer
      });
    } catch (error) {
      console.error('Error in updateCustomer:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update customer',
        error: error.message
      });
    }
  };

  /**
   * Delete a customer if they have no quotations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteCustomer = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the customer with associated quotations
      const customer = await Customer.findByPk(id, {
        include: [{
          model: Quotation,
          as: 'quotations',
          attributes: ['id']
        }]
      });
      
      if (!customer) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found'
        });
      }
      
      // Check if customer has quotations
      if (customer.quotations && customer.quotations.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete customer with existing quotations'
        });
      }
      
      // Delete the customer
      await customer.destroy();
      
      res.status(200).json({
        status: 'success',
        message: 'Customer deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCustomer:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete customer',
        error: error.message
      });
    }
  };

  /**
   * Convert a customer query to a customer
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  convertQueryToCustomer = async (req, res) => {
    try {
      const { query_id } = req.params;
      
      // Find the query
      const query = await CustomerQuery.findByPk(query_id);
      
      if (!query) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer query not found'
        });
      }
      
      // Check if a customer with this company name already exists
      let customer = await Customer.findOne({
        where: { company_name: query.company_name }
      });
      
      if (customer) {
        return res.status(200).json({
          status: 'success',
          message: 'Customer already exists',
          data: customer
        });
      }
      
      // Create a new customer from the query data
      customer = await Customer.create({
        company_name: query.company_name,
        email: query.email,
        phone: query.contact_number,
        site_location: query.site_location
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Customer created from query',
        data: customer
      });
    } catch (error) {
      console.error('Error in convertQueryToCustomer:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to convert query to customer',
        error: error.message
      });
    }
  };
}

module.exports = new CustomerController();