const express = require('express');
const quotationTemplateController = require('../controllers/quotationTemplateController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);
router.get('/', asyncHandler(quotationTemplateController.getAllTemplates));
router.get('/default', asyncHandler(quotationTemplateController.getDefaultTemplate));
router.get('/:id', asyncHandler(quotationTemplateController.getById));
router.post('/', asyncHandler(quotationTemplateController.createTemplate));
router.put('/:id', asyncHandler(quotationTemplateController.updateTemplate));
router.delete('/:id', asyncHandler(quotationTemplateController.deleteTemplate));
router.patch('/:id/set-default', asyncHandler(quotationTemplateController.setDefaultTemplate));

module.exports = router;