const BaseController = require('./baseController');
const {
  Quotation,
  QuotationItem,
  QuotationTerms,
  Customer,
  Machine,
  TermsConditions,
  CompanyDetails,
  QuotationTemplate,
  sequelize
} = require('../models');
const { Op } = require('sequelize');
const { generateQuotationPdf } = require('../utils/pdfGenerator');
const { sendQuotationEmail } = require('../services/emailService');
const emailJobService = require('../services/emailJobService');

class QuotationController extends BaseController {
  constructor() {
    super(Quotation);
  }


/**
 * Create a new quotation without storing in database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
createQuotation = async (req, res) => {
  try {
    const {
      customer,
      quotation_date,
      validity_period,
      notes,
      items,
      terms_conditions,
      template_id  // Added parameter for template selection
    } = req.body;

    console.log('\n================================');
    console.log('customer : ' + JSON.stringify(customer), 'quotation_date : ' + quotation_date, 'notes : ' + notes, 'items : ' + JSON.stringify(items),
'validity_period : ' + validity_period,
'terms_conditions : ' + JSON.stringify(terms_conditions),
'template_id : ' + template_id);
    
    console.log('\n================================');

    
    
    // Validate required fields
    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer details and at least one item are required'
      });
    }
    
    // Generate quotation number (format: QT-YYYYMMDD-XXX)
    const date = quotation_date ? new Date(quotation_date) : new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now(); // Use timestamp to ensure uniqueness
    const quotationNumber = `QT-${dateStr}-${timestamp.toString().slice(-6)}`;
    
    // Calculate totals
    let totalAmount = 0;
    let gstAmount = 0;
    
    // Fetch machines to get accurate prices if machine_id is provided
    const machineIds = items.filter(item => item.machine_id).map(item => item.machine_id);
    let machineMap = {};
    
    if (machineIds.length > 0) {
      const machines = await Machine.findAll({
        where: {
          id: {
            [Op.in]: machineIds
          }
        }
      });
      
      machines.forEach(machine => {
        machineMap[machine.id] = machine;
      });
    }
    
    // Calculate item prices and totals
    const processedItems = items.map(item => {
      const machine = item.machine_id ? machineMap[item.machine_id] : null;
      
      // Use provided values or get from machine if available
      const name = item.name || (machine ? machine.name : 'Custom Item');
      const description = item.description || (machine ? machine.description : '');
      const unitPrice = item.unit_price || (machine ? machine.price : 0);
      const gstPercentage = item.gst_percentage || (machine ? machine.gst_percentage : 18.00); // Default GST: 18%
      const quantity = item.quantity || 1;
      const duration = item.duration || 'Per Month';
      
      // Calculate subtotal
      const subtotal = unitPrice * quantity;
      
      // Add to running totals
      totalAmount += subtotal;
      gstAmount += (subtotal * gstPercentage) / 100;
      
      // Return processed item
      return {
        name,
        description,
        quantity,
        unit_price: unitPrice,
        gst_percentage: gstPercentage,
        duration,
        subtotal
      };
    });
    
    const grandTotal = totalAmount + gstAmount;
    
    // Process terms and conditions if provided
    let processedTerms = [];
    
    if (terms_conditions && Array.isArray(terms_conditions) && terms_conditions.length > 0) {
      // If terms_conditions contains actual term objects with title and description
      if (terms_conditions[0].title) {
        processedTerms = terms_conditions.map((term, index) => ({
          title: term.title,
          description: term.description,
          display_order: index + 1
        }));
      } 
      // If terms_conditions contains IDs, fetch from database
      else {
        const termIds = terms_conditions.map(term => typeof term === 'object' ? term.id : term);
        
        const fetchedTerms = await TermsConditions.findAll({
          where: {
            id: {
              [Op.in]: termIds
            }
          }
        });
        
        // Maintain the order specified in the request
        processedTerms = termIds.map((id, index) => {
          const term = fetchedTerms.find(t => t.id === id);
          return term ? {
            title: term.title,
            description: term.description,
            display_order: index + 1
          } : null;
        }).filter(Boolean); // Remove nulls
      }
    } else {
      // Use default terms if none provided
      const defaultTerms = await TermsConditions.findAll({
        where: { is_default: true },
        order: [['display_order', 'ASC']]
      });
      
      processedTerms = defaultTerms.map((term, index) => ({
        title: term.title,
        description: term.description,
        display_order: index + 1
      }));
    }
    
    // Get company details
    const companyDetails = await CompanyDetails.findOne();
    
    if (!companyDetails) {
      return res.status(404).json({
        status: 'error',
        message: 'Company details not found'
      });
    }
    
    // Get template if specified, otherwise use default
    let template = null;
    if (template_id) {
      template = await QuotationTemplate.findByPk(template_id);
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: 'Specified template not found'
        });
      }
    } else {
      // Get default template
      template = await QuotationTemplate.findOne({
        where: { is_default: true }
      });
      
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: 'No default template found'
        });
      }
    }
    
    // Prepare data for PDF generation
    const quotationData = {
      quotation_number: quotationNumber,
      quotation_date: date,
      validity_period: validity_period || 15,
      total_amount: totalAmount,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      notes,
      customer,
      items: processedItems,
      terms: processedTerms,
      company: companyDetails.get({ plain: true }),
      template: template.get({ plain: true })  // Include template data
    };
    
    // Generate PDF
    const pdfBuffer = await generateQuotationPdf(quotationData);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotationNumber}.pdf`);
    
    // Send the PDF
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error in createQuotation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create quotation',
      error: error.message
    });
  }
};

  /**
   * Generate PDF for a quotation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  generatePdf = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the quotation with all related data
      const quotation = await Quotation.findByPk(id, {
        include: [
          {
            model: Customer,
            as: 'customer'
          },
          {
            model: QuotationItem,
            as: 'items',
            include: [
              {
                model: Machine,
                as: 'machine'
              }
            ]
          },
          {
            model: QuotationTerms,
            as: 'terms',
            include: [
              {
                model: TermsConditions,
                as: 'termsCondition'
              }
            ],
            order: [['display_order', 'ASC']]
          }
        ]
      });
      
      if (!quotation) {
        return res.status(404).json({
          status: 'error',
          message: 'Quotation not found'
        });
      }
      
      // Get company details
      const companyDetails = await CompanyDetails.findOne();
      
      if (!companyDetails) {
        return res.status(404).json({
          status: 'error',
          message: 'Company details not found'
        });
      }
      
      // Prepare data for PDF generation
      const quotationData = {
        ...quotation.get({ plain: true }),
        company: companyDetails.get({ plain: true })
      };
      
      // Generate PDF
      const pdfBuffer = await generateQuotationPdf(quotationData);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotation.quotation_number}.pdf`);
      
      // Send the PDF
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error in generatePdf:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate PDF',
        error: error.message
      });
    }
  };

/**
 * Send quotation to customer via email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
sendQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the quotation with all related data
    const quotation = await Quotation.findByPk(id, {
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: QuotationItem,
          as: 'items',
          include: [
            {
              model: Machine,
              as: 'machine'
            }
          ]
        },
        {
          model: QuotationTerms,
          as: 'terms',
          include: [
            {
              model: TermsConditions,
              as: 'termsCondition'
            }
          ],
          order: [['display_order', 'ASC']]
        }
      ]
    });
    
    if (!quotation) {
      return res.status(404).json({
        status: 'error',
        message: 'Quotation not found'
      });
    }
    
    // Check if customer has email
    if (!quotation.customer.email) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer email is missing'
      });
    }
    
    // Get company details
    const companyDetails = await CompanyDetails.findOne();
    
    if (!companyDetails) {
      return res.status(404).json({
        status: 'error',
        message: 'Company details not found'
      });
    }
    
    // Prepare data for PDF generation
    const quotationData = {
      ...quotation.get({ plain: true }),
      company: companyDetails.get({ plain: true })
    };
    
    // Generate PDF
    const pdfBuffer = await generateQuotationPdf(quotationData);
    
    // Queue email job (immediate sending)
    await emailJobService.createEmailJob('quotation', {
      quotation: quotation.get({ plain: true }),
      pdfBuffer: pdfBuffer.toString('base64'), // Convert buffer to base64 for storage
      companyDetails: companyDetails.get({ plain: true })
    });
    
    // Update quotation status to 'sent'
    await quotation.update({ status: 'sent' });
    
    res.status(200).json({
      status: 'success',
      message: 'Quotation has been queued for sending'
    });
  } catch (error) {
    console.error('Error in sendQuotation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send quotation',
      error: error.message
    });
  }
};
  

 
}

module.exports = new QuotationController();