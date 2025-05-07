const { CompanyDetails } = require('../models');
const cloudinaryService = require('../services/cloudinaryService');
const path = require('path');

class CompanyDetailsController {
  /**
   * Get company details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCompanyDetails = async (req, res) => {
    try {
      // Get company details (there should be only one record)
      const companyDetails = await CompanyDetails.findOne();
      
      res.status(200).json({
        status: 'success',
        data: companyDetails
      });
    } catch (error) {
      console.error('Error in getCompanyDetails:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch company details',
        error: error.message
      });
    }
  };
  
  /**
   * Update company details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateCompanyDetails = async (req, res) => {
    try {
      const {
        company_name,
        gst_number,
        email,
        phone,
        address
      } = req.body;
      
      // Get existing company details
      let companyDetails = await CompanyDetails.findOne();
      
      if (!companyDetails) {
        // Create new record if it doesn't exist
        companyDetails = await CompanyDetails.create({
          company_name,
          gst_number,
          email,
          phone,
          address
        });
      } else {
        // Update existing record
        await companyDetails.update({
          company_name: company_name || companyDetails.company_name,
          gst_number: gst_number || companyDetails.gst_number,
          email: email || companyDetails.email,
          phone: phone || companyDetails.phone,
          address: address || companyDetails.address
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Company details updated successfully',
        data: companyDetails
      });
    } catch (error) {
      console.error('Error in updateCompanyDetails:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update company details',
        error: error.message
      });
    }
  };
  
  /**
   * Upload company logo
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  uploadLogo = async (req, res) => {
    try {
      // Check if file exists in request
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No logo file uploaded'
        });
      }
      
      // Get existing company details
      let companyDetails = await CompanyDetails.findOne();
      
      if (!companyDetails) {
        return res.status(404).json({
          status: 'error',
          message: 'Company details not found. Please create company details first'
        });
      }
      
      // Process the file upload
      const fileBuffer = req.file.buffer;
      const fileExtension = path.extname(req.file.originalname);
      
      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadFile(
        fileBuffer,
        'company',
        {
          public_id: `logo_${Date.now()}${fileExtension}`,
          resource_type: 'image'
        }
      );
      
      // Delete old logo if exists
      if (companyDetails.logo_url) {
        // Extract public ID from URL
        const publicId = companyDetails.logo_url.split('/').pop().split('.')[0];
        try {
          await cloudinaryService.deleteFile(`company/${publicId}`);
        } catch (deleteError) {
          console.error('Error deleting old logo:', deleteError);
          // Continue with update even if logo deletion fails
        }
      }
      
      // Update company details with new logo URL
      await companyDetails.update({
        logo_url: uploadResult.secure_url
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Logo uploaded successfully',
        data: {
          logo_url: uploadResult.secure_url
        }
      });
    } catch (error) {
      console.error('Error in uploadLogo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to upload logo',
        error: error.message
      });
    }
  };
  
  /**
   * Upload company signature
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  uploadSignature = async (req, res) => {
    try {
      // Check if file exists in request
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No signature file uploaded'
        });
      }
      
      // Get existing company details
      let companyDetails = await CompanyDetails.findOne();
      
      if (!companyDetails) {
        return res.status(404).json({
          status: 'error',
          message: 'Company details not found. Please create company details first'
        });
      }
      
      // Process the file upload
      const fileBuffer = req.file.buffer;
      const fileExtension = path.extname(req.file.originalname);
      
      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadFile(
        fileBuffer,
        'company',
        {
          public_id: `signature_${Date.now()}${fileExtension}`,
          resource_type: 'image'
        }
      );
      
      // Delete old signature if exists
      if (companyDetails.signature_url) {
        // Extract public ID from URL
        const publicId = companyDetails.signature_url.split('/').pop().split('.')[0];
        try {
          await cloudinaryService.deleteFile(`company/${publicId}`);
        } catch (deleteError) {
          console.error('Error deleting old signature:', deleteError);
          // Continue with update even if signature deletion fails
        }
      }
      
      // Update company details with new signature URL
      await companyDetails.update({
        signature_url: uploadResult.secure_url
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Signature uploaded successfully',
        data: {
          signature_url: uploadResult.secure_url
        }
      });
    } catch (error) {
      console.error('Error in uploadSignature:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to upload signature',
        error: error.message
      });
    }
  };
}

module.exports = new CompanyDetailsController();