const express = require('express');
const termsConditionsController = require('../controllers/termsConditionsController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);
router.get('/', asyncHandler(termsConditionsController.getAllTerms));
router.get('/categories', asyncHandler(termsConditionsController.getCategories));
router.get('/:id', asyncHandler(termsConditionsController.getById));
router.post('/', asyncHandler(termsConditionsController.createTerm));
router.put('/:id', asyncHandler(termsConditionsController.updateTerm));
router.delete('/:id', asyncHandler(termsConditionsController.deleteTerm));
router.post('/update-order', asyncHandler(termsConditionsController.updateOrder));

module.exports = router;