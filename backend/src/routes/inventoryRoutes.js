const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);

// Inventory item routes
router.get('/', asyncHandler(inventoryController.getAllInventoryItems));
router.get('/low-stock', asyncHandler(inventoryController.getLowStockItems));
router.get('/:id', asyncHandler(inventoryController.getInventoryItemById));
router.post('/', upload.single('image'), handleUploadError, asyncHandler(inventoryController.createInventoryItem));
router.put('/:id', upload.single('image'), handleUploadError, asyncHandler(inventoryController.updateInventoryItem));
router.delete('/:id', asyncHandler(inventoryController.deleteInventoryItem));

// Batch and transaction routes
router.post('/:id/batches', asyncHandler(inventoryController.addBatch));
router.post('/transactions', asyncHandler(inventoryController.recordTransaction));
router.get('/batches/:batchId/transactions', asyncHandler(inventoryController.getBatchTransactions));

module.exports = router;