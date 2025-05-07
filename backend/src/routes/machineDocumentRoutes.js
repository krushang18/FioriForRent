const express = require('express');
const machineDocumentController = require('../controllers/machineDocumentController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(verifyToken);

// Document routes
router.get('/', asyncHandler(machineDocumentController.getAllDocuments));
router.get('/expiring', asyncHandler(machineDocumentController.getExpiringDocuments));
router.get('/:id', asyncHandler(machineDocumentController.getDocumentById));
router.post('/', asyncHandler(machineDocumentController.createDocument));
router.put('/:id', asyncHandler(machineDocumentController.updateDocument));
router.delete('/:id', asyncHandler(machineDocumentController.deleteDocument));

module.exports = router;