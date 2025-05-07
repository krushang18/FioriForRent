const express = require('express');
const quotationController = require('../controllers/quotationController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);

router.post('/', asyncHandler(quotationController.createQuotation));
router.get('/:id/pdf', asyncHandler(quotationController.generatePdf));
router.post('/:id/send', asyncHandler(quotationController.sendQuotation));

module.exports = router;