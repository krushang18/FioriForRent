const express = require('express');
const authRoutes = require('./authRoutes');
const customerQueryRoutes = require('./customerQueryRoutes');
const machineRoutes = require('./machineRoutes');
const termsConditionsRoutes = require('./termsConditionsRoutes');
const customerRoutes = require('./customerRoutes');
const quotationRoutes = require('./quotationRoutes');
const companyDetailsRoutes = require('./companyDetailsRoutes');
const quotationTemplateRoutes = require('./quotationTemplateRoutes');
const machineDocumentRoutes = require('./machineDocumentRoutes');
const serviceRecordRoutes = require('./serviceRecordRoutes');
const inventoryRoutes = require('./inventoryRoutes');

console.log("\n\n");
const router = express.Router();


// API Routes
router.use('/auth', authRoutes);
router.use('/queries', customerQueryRoutes);
router.use('/machines', machineRoutes);
router.use('/terms', termsConditionsRoutes);
router.use('/customers', customerRoutes);
router.use('/quotations', quotationRoutes);
router.use('/company', companyDetailsRoutes);
router.use('/templates', quotationTemplateRoutes);
router.use('/machine-documents', machineDocumentRoutes);
router.use('/services', serviceRecordRoutes);
router.use('/inventory', inventoryRoutes);

// API health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;