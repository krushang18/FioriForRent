const emailJobService = require('./emailJobService');
const logger = require('../utils/logger');
const machineDocumentController = require('../controllers/machineDocumentController');

// Processor state
let isRunning = false;
let processorInterval = null;

/**
 * Start the email job processor
 * @param {number} intervalMs - Processing interval in milliseconds
 */
const startProcessing = async (intervalMs = 60000) => {
  if (isRunning) {
    logger.warn('Email processor is already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Email job processor started with ${intervalMs}ms interval`);
  
  // Reset any hung jobs before starting
  await emailJobService.resetHungJobs();
  
  // Check for any missing document notifications
  await machineDocumentController.checkMissingNotifications();
  
  // Regular interval to process jobs
  processorInterval = setInterval(async () => {
    if (!isRunning) return;
    
    try {
      // Process one job at a time
      const job = await emailJobService.processNextJob();
      
      // If no job was processed, don't wait for the next full interval
      if (!job) {
        // Wait a shorter time before checking again
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, intervalMs / 3)));
      }
    } catch (error) {
      logger.error('Error in email processor interval:', error);
    }
  }, intervalMs);
  
  // Periodically reset hung jobs
  setInterval(async () => {
    if (isRunning) {
      await emailJobService.resetHungJobs();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
};

/**
 * Stop the email job processor
 */
const stopProcessing = () => {
  if (!isRunning) return;
  
  isRunning = false;
  
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
  
  logger.info('Email job processor stopped');
};

/**
 * Get the current status of the processor
 * @returns {Promise<Object>} - Status information
 */
const getProcessorStatus = async () => {
  const jobStats = await emailJobService.getJobStats();
  
  return {
    isRunning,
    jobStats
  };
};

module.exports = {
  startProcessing,
  stopProcessing,
  getProcessorStatus
};