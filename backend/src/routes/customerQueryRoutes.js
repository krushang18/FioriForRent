const express = require('express');
const customerQueryController = require('../controllers/customerQueryController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes for customer query submission
router.post('/submit', asyncHandler(customerQueryController.submitQuery));

// Protected routes for admin access
router.use(verifyToken);
router.get('/', asyncHandler(customerQueryController.getAllQueries));
router.get('/export/excel', asyncHandler(customerQueryController.exportToExcel));
router.get('/export/pdf', asyncHandler(customerQueryController.generatePdfReport));
router.post('/export/pdf', asyncHandler(customerQueryController.generatePdfReport));
router.get('/:id', asyncHandler(customerQueryController.getById));
router.patch('/:id/status', asyncHandler(customerQueryController.updateStatus));
router.delete('/:id', asyncHandler(customerQueryController.delete));

module.exports = router;