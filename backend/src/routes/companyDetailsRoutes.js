const express = require('express');
const companyDetailsController = require('../controllers/companyDetailsController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public route to get company details
router.get('/public', asyncHandler(companyDetailsController.getCompanyDetails));

// Protected routes for admin access
router.use(verifyToken);
router.get('/', asyncHandler(companyDetailsController.getCompanyDetails));
router.put('/', asyncHandler(companyDetailsController.updateCompanyDetails));
router.post('/logo', upload.single('logo'), handleUploadError, asyncHandler(companyDetailsController.uploadLogo));
router.post('/signature', upload.single('signature'), handleUploadError, asyncHandler(companyDetailsController.uploadSignature));

module.exports = router;