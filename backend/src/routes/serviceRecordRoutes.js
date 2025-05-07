const express = require('express');
const serviceRecordController = require('../controllers/serviceRecordController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);

// Service record routes
router.get('/', asyncHandler(serviceRecordController.getAllServiceRecords));
router.get('/recent', asyncHandler(serviceRecordController.getRecentServiceRecords));
router.get('/:id', asyncHandler(serviceRecordController.getServiceRecordById));
router.post('/', asyncHandler(serviceRecordController.createServiceRecord));
router.put('/:id', asyncHandler(serviceRecordController.updateServiceRecord));
router.delete('/:id', asyncHandler(serviceRecordController.deleteServiceRecord));

// Service description item routes
router.get('/description-items/all', asyncHandler(serviceRecordController.getAllDescriptionItems));
router.post('/description-items', asyncHandler(serviceRecordController.createDescriptionItem));
router.delete('/description-items/:id', asyncHandler(serviceRecordController.deleteDescriptionItem));

module.exports = router;