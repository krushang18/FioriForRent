/**
 * Send document expiry notification email
 * @param {Object} document - Machine document data with machine information
 * @param {Number} daysBefore - Days before expiry to send notification
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendDocumentExpiryNotification = async (document, daysBefore) => {
  try {
    // Get admin emails
    const adminUsers = await User.findAll();
    const adminEmails = adminUsers.map(user => user.email);
    
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

// Export the function to be available in the module
module.exports = {
  // ... existing exports
  sendDocumentExpiryNotification
};