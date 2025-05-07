const express = require('express');
const machineController = require('../controllers/machineController');
const { verifyToken, asyncHandler } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public routes for viewing machines
router.get('/public', asyncHandler(machineController.getAllMachines));

// Protected routes for admin access
router.use(verifyToken);
router.get('/', asyncHandler(machineController.getAllMachines));
router.get('/:id', asyncHandler(machineController.getById));
router.post('/', upload.single('image'), handleUploadError, asyncHandler(machineController.createMachine));
router.put('/:id', upload.single('image'), handleUploadError, asyncHandler(machineController.updateMachine));
router.delete('/:id', asyncHandler(machineController.deleteMachine));
router.patch('/:id/toggle-active', asyncHandler(machineController.toggleActive));

module.exports = router;