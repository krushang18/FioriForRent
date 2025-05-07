const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const { User, CompanyDetails } = require('../models'); // Import the models

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Load and compile email template
 * @param {string} templateName - Template filename without extension
 * @returns {Function} - Compiled Handlebars template
 */
const loadTemplate = (templateName) => {
  const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  return handlebars.compile(templateSource);
};

/**
 * Send an email
 * @param {Object} mailOptions - Mail options (to, subject, html, etc.)
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendEmail = async (mailOptions) => {
  try {
    const defaultOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      ...mailOptions
    };
    
    return await transporter.sendMail(defaultOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send customer query confirmation email
 * @param {Object} query - Customer query data
 * @param {Object} companyDetails - Company details
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendQueryConfirmation = async (query, companyDetails) => {
  try {
    console.log('\n----------------------------------------------------\n');
    console.log('sendQueryConfirmation : '+query.company_name);
    console.log('\n----------------------------------------------------\n');
    
    // Convert Sequelize model instance to plain object if needed
    const queryData = query.toJSON ? query.toJSON() : query;
    const companyData = companyDetails.toJSON ? companyDetails.toJSON() : companyDetails;
    
    const template = loadTemplate('query-confirmation');
    const html = template({
      query: queryData,
      company: companyData || { company_name: 'M/S O.C.Shah' },
      date: new Date().toLocaleString()
    });

    return await sendEmail({
      to: queryData.email,
      subject: `Your Query Has Been Received - ${queryData.company_name}`,
      html
    });
  } catch (error) {
    console.error('Query confirmation email error:', error);
    throw error;
  }
};

/**
 * Send admin notification about new customer query
 * @param {Object} query - Customer query data
 * @param {Array<string>} adminEmails - List of admin email addresses
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendNewQueryNotification = async (query, adminEmails, adminUrl = '#') => {
  try {
    console.log('\n----------------------------------------------------\n');
    console.log('sendNewQueryNotification : '+query.company_name);
    console.log('\n----------------------------------------------------\n');

    // Convert Sequelize model instance to plain object if needed
    const queryData = query.toJSON ? query.toJSON() : query;
    
    const template = loadTemplate('admin-query-notification');
    const html = template({
      query: queryData,
      date: new Date().toLocaleString(),
      adminUrl: adminUrl
    });

    return await sendEmail({
      to: adminEmails.join(','),
      subject: `New Customer Query: ${queryData.company_name}`,
      html
    });
  } catch (error) {
    console.error('Admin notification email error:', error);
    throw error;
  }
};

/**
 * Send document expiry notification email
 * @param {Object} document - Machine document data with machine information
 * @param {Number} daysBefore - Days before expiry to send notification
 * @param {Array} adminEmails - Optional array of admin emails (if not provided, fetched from DB)
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendDocumentExpiryNotification = async (document, daysBefore, adminEmails = null) => {
  try {
    // Get admin emails if not provided
    if (!adminEmails) {
      const adminUsers = await User.findAll();
      adminEmails = adminUsers.map(user => user.email);
    }
    
    if (!adminEmails || adminEmails.length === 0) {
      throw new Error('No admin emails found to send notification');
    }
    
    // Get company details for template
    const companyDetails = await CompanyDetails.findOne();
    
    if (!companyDetails) {
      throw new Error('Company details not found');
    }
    
    // Load and compile the template
    const template = loadTemplate('document-expiry-notification');
    
    // Determine urgency (3 days or less is urgent)
    const isUrgent = daysBefore <= 3;
    const sameDay = daysBefore === 0;
    
    // Prepare template data
    const emailData = {
      document,
      daysBefore,
      isUrgent,
      sameDay,
      company: companyDetails,
      adminUrl: process.env.ADMIN_URL || 'http://localhost:3000/admin',
      currentYear: new Date().getFullYear(),
      formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    };
    
    // Generate HTML content
    const html = template(emailData);
    
    // Get document type in readable format
    const documentTypeMap = {
      RC_Book: 'RC Book',
      PUC: 'PUC Certificate',
      Fitness: 'Fitness Certificate',
      Insurance: 'Insurance'
    };
    
    const documentType = documentTypeMap[document.document_type] || document.document_type;
    
    // Create subject line based on urgency
    let subject;
    if (sameDay) {
      subject = `URGENT: ${documentType} for ${document.machine.name} EXPIRES TODAY!`;
    } else if (isUrgent) {
      subject = `URGENT: ${documentType} for ${document.machine.name} expiring in ${daysBefore} days`;
    } else {
      subject = `Reminder: ${documentType} for ${document.machine.name} expiring in ${daysBefore} days`;
    }
    
    // Send email to all admins
    return await sendEmail({
      to: adminEmails.join(','),
      subject,
      html
    });
  } catch (error) {
    console.error('Document expiry notification email error:', error);
    throw error;
  }
};

/**
 * Send quotation email to customer
 * @param {Object} quotation - Quotation data with all relations
 * @param {Buffer} pdfBuffer - Quotation PDF buffer
 * @param {Object} companyDetails - Company details
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendQuotationEmail = async (quotation, pdfBufferOrBase64, companyDetails) => {
  try {
    const template = loadTemplate('quotation-email');
    const html = template({
      quotation,
      company: companyDetails,
      customer: quotation.customer,
      date: new Date().toLocaleString(),
      validUntil: new Date(
        new Date(quotation.quotation_date).getTime() + quotation.validity_period * 24 * 60 * 60 * 1000
      ).toLocaleDateString()
    });
    
    // Handle both Buffer and base64 string
    let pdfBuffer;
    if (typeof pdfBufferOrBase64 === 'string') {
      // Convert base64 back to buffer
      pdfBuffer = Buffer.from(pdfBufferOrBase64, 'base64');
    } else {
      pdfBuffer = pdfBufferOrBase64;
    }

    return await sendEmail({
      to: quotation.customer.email,
      subject: `Quotation ${quotation.quotation_number} - ${companyDetails.company_name}`,
      html,
      attachments: [
        {
          filename: `Quotation_${quotation.quotation_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  } catch (error) {
    console.error('Quotation email error:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendQueryConfirmation,
  sendNewQueryNotification,
  sendDocumentExpiryNotification,
  sendQuotationEmail
};