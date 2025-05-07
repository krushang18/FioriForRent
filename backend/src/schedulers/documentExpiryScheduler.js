/**
 * This file contains scheduled tasks for document expiry notifications
 */
const cron = require('node-cron');
const machineDocumentController = require('../controllers/machineDocumentController');
const logger = require('../utils/logger');

/**
 * Schedule document expiry check to run daily at 8:00 AM
 * This ensures any missed notifications are caught
 */
const scheduleDocumentExpiryCheck = () => {
  // Run daily at 8:00 AM
  cron.schedule('0 0 8 * * *', async () => {
    logger.info('Running scheduled check for missing document notifications');
    
    try {
      const result = await machineDocumentController.checkMissingNotifications();
      
      if (result.success) {
        logger.info(`Document notification check completed successfully. Checked ${result.scheduledCount} documents.`);
      } else {
        logger.error('Document notification check failed:', result.error);
      }
    } catch (error) {
      logger.error('Error in scheduled document notification check:', error);
    }
  });
  
  logger.info('Document notification check scheduled to run daily at 8:00 AM');
};

module.exports = {
  scheduleDocumentExpiryCheck
};