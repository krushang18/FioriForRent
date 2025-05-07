const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Handlebars = require('handlebars');
const html2pdf = require('html-pdf');

/**
 * Generate a quotation PDF using the HTML template
 * @param {Object} quotationData - The quotation data
 * @param {Object} options - PDF generation options
 * @returns {Promise<Buffer>} - The generated PDF as a buffer
 */
const generateQuotationPdf = (quotationData, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Read the HTML template
      const templatePath = path.join(__dirname, '../templates/pdf/quotationTemplate.html');
      const htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

      // Compile the Handlebars template
      const template = Handlebars.compile(htmlTemplate);

      // Calculate total amount and GST from items if not provided
      const items = quotationData.items || [];
      const totalAmount = quotationData.total_amount || 
        items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseFloat(item.quantity)), 0);
      
      const gstPercentage = quotationData.gst_percentage || 
        (items.length > 0 ? parseFloat(items[0].gst_percentage || 18) : 18);
      
      const gstAmount = quotationData.gst_amount || totalAmount * (gstPercentage / 100);
      const grandTotal = quotationData.grand_total || totalAmount + gstAmount;

      // Process terms and conditions
      let processedTerms = [];
      
      if (quotationData.terms && Array.isArray(quotationData.terms)) {
        processedTerms = quotationData.terms.map(term => {
          // Handle different term structures
          if (term.termsCondition) {
            return term;
          } else if (term.title) {
            return { termsCondition: term };
          } else if (typeof term === 'object' && term.id) {
            // For this case, ideally we'd fetch from DB, but for simplicity:
            return { 
              termsCondition: { 
                title: `Term ID: ${term.id}`,
                description: term.description || ''
              } 
            };
          } else {
            return { 
              termsCondition: { 
                title: String(term),
                description: ''
              } 
            };
          }
        });
      }

      // Prepare data for the template
      const templateData = {
        company: quotationData.company,
        customer: quotationData.customer,
        current_year: new Date().getFullYear(),
        quotation: {
          quotation_number: quotationData.quotation_number || '',
          quotation_date: moment(quotationData.quotation_date).format('DD/MM/YYYY'),
          valid_until: moment(quotationData.quotation_date)
            .add(quotationData.validity_period || 15, 'days')
            .format('DD/MM/YYYY'),
          total_amount: totalAmount.toFixed(2),
          gst_amount: gstAmount.toFixed(2),
          gst_percentage: gstPercentage.toFixed(2),
          grand_total: grandTotal.toFixed(2),
          total_amount_words: numberToWords(Math.round(grandTotal)),
          notes: quotationData.notes || ''
        },
        items: items.map((item, index) => ({
          ...item,
          index: index + 1, // Start from 1 instead of 0
          name: item.name || (item.machine ? item.machine.name : 'Unnamed Item'),
          description: item.description || (item.machine ? item.machine.description : ''),
          unit_price: parseFloat(item.unit_price || 0).toFixed(2),
          gst_percentage: parseFloat(item.gst_percentage || gstPercentage).toFixed(2),
          subtotal: (parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 1)).toFixed(2)
        })),
        terms: processedTerms
      };

      // Render the HTML template with data
      const renderedHtml = template(templateData);

      // HTML to PDF conversion options
      const pdfOptions = { 
        format: 'A4', 
        orientation: 'portrait',
        border: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm"
        },
        footer: {
          height: "10mm",
          contents: {
            default: '<div style="text-align: center; font-size: 10px; color: #555;">' +
                    'This is a computer-generated quotation. No signature required.<br>' +
                    `© ${new Date().getFullYear()} ${quotationData.company.company_name} | All Rights Reserved` +
                    '</div>'
          }
        }
      };

      // Convert HTML to PDF
      html2pdf.create(renderedHtml, pdfOptions).toBuffer((err, buffer) => {
        if (err) {
          console.error('Error converting HTML to PDF:', err);
          reject(err);
        } else {
          resolve(buffer);
        }
      });
    } catch (error) {
      console.error('Error in PDF generation:', error);
      reject(error);
    }
  });
};

/**
 * Convert a number to words (Indian numbering system)
 * @param {number} number - Number to convert
 * @returns {string} - Number in words
 */
function numberToWords(number) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  if (number === 0) return 'Zero Rupees Only';

  function convertHundreds(n) {
    if (n === 0) return '';
    
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    
    if (n > 0) {
      if (n < 10) {
        str += units[n] + ' ';
      } else if (n < 20) {
        str += teens[n - 10] + ' ';
      } else {
        str += tens[Math.floor(n / 10)] + ' ';
        if (n % 10 > 0) {
          str += units[n % 10] + ' ';
        }
      }
    }
    
    return str;
  }

  let result = '';
  let scaleIndex = 0;
  
  while (number > 0) {
    if (number % 1000 !== 0) {
      result = convertHundreds(number % 1000) + scales[scaleIndex] + ' ' + result;
    }
    number = Math.floor(number / 1000);
    scaleIndex++;
  }

  return result.trim() + ' Rupees Only';
}

/**
 * Generate a query report PDF with multiple queries
 * @param {Array} queries - Array of customer queries
 * @param {Object} companyDetails - Company details
 * @returns {Promise<Buffer>} - The generated PDF as a buffer
 */
const generateQueryReportPdf = (queries, companyDetails) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Customer Queries Report',
          Author: companyDetails.company_name,
          Subject: 'Concrete Mixer Rental Customer Queries',
          Keywords: 'queries, customers, concrete mixer'
        },
        bufferPages: true // Enable page buffering for pagination
      });

      // Buffer to store PDF
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Define colors
      const primaryColor = '#0081C9';
      const secondaryColor = '#FFC93C';
      const textColor = '#333333';
      
      // Track the starting Y position for each page
      const startY = 50;
      const pageWidth = doc.page.width;
      
      // Function to add header to each page
      const addHeader = () => {
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor(primaryColor)
           .text(companyDetails.company_name, 0, startY, { align: 'center' });
           
        doc.moveDown(0.5);
        doc.fontSize(16)
           .fillColor(textColor)
           .text('CUSTOMER QUERIES REPORT', { align: 'center' });
           
        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor(textColor)
           .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
           
        // Remove phone and email from header as requested
        
        // Add horizontal line
        doc.moveDown(1);
        doc.moveTo(50, doc.y)
           .lineTo(pageWidth - 50, doc.y)
           .strokeColor(primaryColor)
           .lineWidth(1)
           .stroke();
           
        doc.moveDown(1);
        
        // Return the Y position after the header for consistent query positioning
        return doc.y;
      };
      
      // Add the initial header and get the starting Y position for queries
      const queryStartY = addHeader();
      
      // Add queries
      if (queries.length === 0) {
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor(textColor)
           .text('No queries found matching your criteria.', { align: 'center' });
      } else {
        // Loop through queries
        queries.forEach((query, index) => {
          // Check if we need a new page - ensure enough space for at least the query header
          if (doc.y > 680 && index > 0) {
            doc.addPage();
            // Add header to the new page and reset Y position to ensure consistent alignment
            const newPageQueryStartY = addHeader();
            doc.y = newPageQueryStartY; // Set the Y position explicitly for consistency
          }

          // Add query title with fixed left margin of 50
          doc.font('Helvetica-Bold')
             .fontSize(14)
             .fillColor(primaryColor)
             .text(`Query #${index + 1}: ${query.company_name}`, 50, doc.y);
             
          doc.moveDown(0.5);
          
          // Create table-like structure for query details
          const leftColumnWidth = 150;
          const fieldLabels = [
            { label: 'Date:', value: new Date(query.created_at).toLocaleDateString() },
            { label: 'Status:', value: query.status.charAt(0).toUpperCase() + query.status.slice(1).replace('_', ' ') },
            { label: 'Contact:', value: query.contact_number },
            { label: 'Email:', value: query.email },
            { label: 'Site Location:', value: query.site_location },
            { label: 'Duration Needed:', value: query.duration }
          ];
          
          // Add fields in a table-like format
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor(textColor);
             
          fieldLabels.forEach(field => {
            doc.font('Helvetica-Bold')
               .text(field.label, 50, doc.y, { continued: true, width: leftColumnWidth });
               
            doc.font('Helvetica')
               .text(field.value, { link: null });
          });
          
          // Add work description
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold')
             .text('Work Description:', 50, doc.y);
             
          doc.font('Helvetica')
             .text(query.work_description, 50, doc.y, { width: pageWidth - 100 });
          
          // Add separator between queries
          if (index < queries.length - 1) {
            doc.moveDown(1);
            doc.moveTo(50, doc.y)
               .lineTo(pageWidth - 50, doc.y)
               .dash(5, { space: 5 })
               .strokeColor(primaryColor)
               .stroke();
               
            doc.moveDown(1);
          }
        });
      }

      // Add page numbers and footers
      const totalPages = doc.bufferedPageRange().count;
      
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        
        // Add footer line
        doc.undash()
           .moveTo(50, 750)
           .lineTo(pageWidth - 50, 750)
           .strokeColor(primaryColor)
           .lineWidth(0.5)
           .stroke();
        
        // Add page number
        doc.font('Helvetica')
           .fillColor(textColor)
           .fontSize(9)
           .text(
             `Page ${i + 1} of ${totalPages}`, 
             0, 
             760, 
             { align: 'center', width: pageWidth }
           );
        
        // Add company info in footer
        doc.font('Helvetica')
           .fillColor(textColor)
           .fontSize(8)
           .text(
             `${companyDetails.company_name} | ${companyDetails.email}`,
             0,
             775,
             { align: 'center', width: pageWidth }
           );
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateQuotationPdf,
  generateQueryReportPdf
};