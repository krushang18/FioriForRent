const BaseController = require('./baseController');
const { CustomerQuery, User, CompanyDetails } = require('../models');
const { sendQueryConfirmation, sendNewQueryNotification } = require('../services/emailService');
// const { sendNewQueryAlert } = require('../services/whatsappService');
const { generateQueryReportPdf } = require('../utils/pdfGenerator');
const ExcelJS = require('exceljs');
const emailJobService = require('../services/emailJobService');
const { Op } = require('sequelize');

class CustomerQueryController extends BaseController {
  constructor() {
    super(CustomerQuery);
  }

/**
 * Get all customer queries with filtering and sorting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
getAllQueries = async (req, res) => {
  try {
    const { status, sortBy, sortOrder, startDate, endDate, search } = req.query;
    
    // Build query conditions
    const whereConditions = {};
    
    if (status) {
      whereConditions.status = status;
    }
    
    if (startDate && endDate) {
      whereConditions.created_at = {
        [Op.between]: [new Date(startDate), new Date(new Date(endDate).setHours(23, 59, 59, 999))]
      };
    } else if (startDate) {
      whereConditions.created_at = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereConditions.created_at = {
        [Op.lte]: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }
    
    // Add search functionality
    if (search) {
      whereConditions[Op.or] = [
        { company_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { site_location: { [Op.like]: `%${search}%` } },
        { work_description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Build sort options
    const order = [];
    if (sortBy) {
      order.push([sortBy, sortOrder === 'desc' ? 'DESC' : 'ASC']);
    } else {
      order.push(['created_at', 'DESC']); // Default sorting
    }
    
    const queries = await CustomerQuery.findAll({
      where: whereConditions,
      order
    });
    
    res.status(200).json({
      status: 'success',
      data: queries
    });
  } catch (error) {
    console.error('Error in getAllQueries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customer queries',
      error: error.message
    });
  }
};


/**
 * Submit a new customer query
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
submitQuery = async (req, res) => {
  try {
    console.log('Received query submission:', req.body);
    
    // Create the query
    const query = await CustomerQuery.create({
      company_name: req.body.company_name,
      email: req.body.email,
      site_location: req.body.site_location,
      contact_number: req.body.contact_number,
      duration: req.body.duration,
      work_description: req.body.work_description,
      status: 'new'
    });
    
    // Get company details
    const companyDetails = { 
      company_name: 'M/S O.C.Shah',
      phone: ['+91-9898020677', '+91-9913737777'],
      email: 'ocsfiori@gmail.com' 
    };
    
    // Get admin users for notifications
    const adminUsers = await User.findAll();
    const adminEmails = adminUsers.map(user => user.email);
    
    // Set admin URL for the admin email template
    const adminUrl = 'http://localhost:3000/admin/inquiries';
    
    // Queue confirmation email - immediate (current date)
    await emailJobService.createEmailJob('query-confirmation', {
      query: query.toJSON(),
      companyDetails
    },null);
    
    // Queue admin notification email - immediate (current date)
    await emailJobService.createEmailJob('admin-notification', {
      query: query.toJSON(),
      adminEmails,
      adminUrl
    },null);
    
    // Immediately return response to the client
    res.status(201).json({
      status: 'success',
      message: 'Your query has been submitted successfully',
      data: query
    });
  } catch (error) {
    console.error('Error in submitQuery:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit query',
      error: error.message
    });
  }
};
  

  /**
   * Update the status of a query
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Validate status
      if (!['new', 'in_progress', 'completed'].includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid status value'
        });
      }
      
      const query = await CustomerQuery.findByPk(id);
      
      if (!query) {
        return res.status(404).json({
          status: 'error',
          message: 'Query not found'
        });
      }
      
      // Update status
      query.status = status;
      await query.save();
      
      res.status(200).json({
        status: 'success',
        message: 'Query status updated successfully',
        data: query
      });
    } catch (error) {
      console.error('Error in updateStatus:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update query status',
        error: error.message
      });
    }
  };

  /**
   * Export queries to Excel
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  exportToExcel = async (req, res) => {
    try {
      const { status, startDate, endDate } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      
      if (status) {
        whereConditions.status = status;
      }
      
      if (startDate && endDate) {
        whereConditions.created_at = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      } else if (startDate) {
        whereConditions.created_at = {
          [Op.gte]: new Date(startDate)
        };
      } else if (endDate) {
        whereConditions.created_at = {
          [Op.lte]: new Date(endDate)
        };
      }
      
      const queries = await CustomerQuery.findAll({
        where: whereConditions,
        order: [['created_at', 'DESC']]
      });
      
      // Create Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Customer Queries');
      
      // Define columns
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Company Name', key: 'company_name', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Contact Number', key: 'contact_number', width: 20 },
        { header: 'Site Location', key: 'site_location', width: 30 },
        { header: 'Duration', key: 'duration', width: 20 },
        { header: 'Work Description', key: 'work_description', width: 50 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'created_at', width: 20 }
      ];
      
      // Add rows
      queries.forEach(query => {
        worksheet.addRow({
          id: query.id,
          company_name: query.company_name,
          email: query.email,
          contact_number: query.contact_number,
          site_location: query.site_location,
          duration: query.duration,
          work_description: query.work_description,
          status: query.status.toUpperCase(),
          created_at: new Date(query.created_at).toLocaleString()
        });
      });
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0081C9' } // Using primary color from your palette
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };
      
      // Set content type and disposition
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-queries.xlsx');
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error in exportToExcel:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export queries to Excel',
        error: error.message
      });
    }
  };

  /**
   * Generate PDF report of queries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  generatePdfReport = async (req, res) => {
    try {
      // Get parameters from either query (GET) or body (POST)
      const params = req.method === 'POST' ? req.body : req.query;
      const { status, startDate, endDate, search, sortBy, sortOrder } = params;
      
      // Build query conditions
      const whereConditions = {};
      
      if (status && status !== 'all') {
        whereConditions.status = status;
      }
      
      if (startDate && endDate) {
        whereConditions.created_at = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      } else if (startDate) {
        whereConditions.created_at = {
          [Op.gte]: new Date(startDate)
        };
      } else if (endDate) {
        whereConditions.created_at = {
          [Op.lte]: new Date(endDate)
        };
      }
      
      // Add search functionality
      if (search) {
        whereConditions[Op.or] = [
          { company_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { contact_number: { [Op.like]: `%${search}%` } },
          { site_location: { [Op.like]: `%${search}%` } },
          { work_description: { [Op.like]: `%${search}%` } }
        ];
      }
      
      // Build sort options
      const order = [];
      if (sortBy) {
        order.push([sortBy, sortOrder === 'desc' ? 'DESC' : 'ASC']);
      } else {
        order.push(['created_at', 'DESC']); // Default sorting
      }
      
      const queries = await CustomerQuery.findAll({
        where: whereConditions,
        order
      });
      
      // Get company details
      const companyDetails = await CompanyDetails.findOne();
      
      if (!companyDetails) {
        return res.status(404).json({
          status: 'error',
          message: 'Company details not found'
        });
      }
      
      // Generate PDF
      const pdfBuffer = await generateQueryReportPdf(queries, companyDetails);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=query-report-${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Send the PDF
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error in generatePdfReport:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate PDF report',
        error: error.message
      });
    }
  };
}

module.exports = new CustomerQueryController();