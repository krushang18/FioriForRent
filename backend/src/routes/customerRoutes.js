const express = require('express');
const customerController = require('../controllers/customerController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);
router.get('/', asyncHandler(customerController.getAllCustomers));
router.get('/:id', asyncHandler(customerController.getCustomerWithHistory));
router.post('/', asyncHandler(customerController.createCustomer));
router.put('/:id', asyncHandler(customerController.updateCustomer));
router.delete('/:id', asyncHandler(customerController.deleteCustomer));
router.post('/convert-query/:query_id', asyncHandler(customerController.convertQueryToCustomer));

module.exports = router;