const { sequelize } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Create a new email job in the database
 * @param {string} type - Type of email job
 * @param {Object} data - Data needed for the job
 * @param {Date|null} scheduledFor - Date when the job should be processed (null for immediate)
 * @param {number} maxAttempts - Maximum number of processing attempts
 * @returns {Promise<number>} - ID of the created job
 */
const createEmailJob = async (type, data, scheduledFor = null, maxAttempts = 3) => {
  try {
    // Ensure data is properly stringified
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Use current timestamp if scheduledFor is null
    const scheduledDate = scheduledFor || new Date();
    
    const [result] = await sequelize.query(
      'INSERT INTO email_jobs (type, data, scheduled_for, max_attempts) VALUES (?, ?, ?, ?)',
      {
        replacements: [type, jsonData, scheduledDate, maxAttempts],
        type: sequelize.QueryTypes.INSERT
      }
    );
    
    logger.info(`Created email job of type ${type} with ID ${result} scheduled for ${scheduledDate}`);
    return result;
  } catch (error) {
    logger.error(`Failed to create email job of type ${type}:`, error);
    throw error;
  }
};

/**
 * Process the next pending email job
 * @returns {Promise<Object|null>} - The processed job or null if no jobs available
 */
const processNextJob = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    // First, get the ID of the next job that is scheduled for now or earlier
    const [nextJobResults] = await sequelize.query(
      `SELECT id FROM email_jobs 
       WHERE status = 'pending' AND attempts < max_attempts
       AND (scheduled_for IS NULL OR scheduled_for <= NOW())
       ORDER BY scheduled_for ASC, created_at ASC 
       LIMIT 1
       FOR UPDATE`
    );
    if (nextJobResults.length === 0) {
      await transaction.commit();
      return null;
    }
    
    const nextJobId = nextJobResults[0].id;
    
    // Now update the job with the obtained ID
    await sequelize.query(
      `UPDATE email_jobs 
       SET status = 'processing', attempts = attempts + 1, updated_at = NOW() 
       WHERE id = ?`,
      {
        replacements: [nextJobId],
        transaction
      }
    );
    
    // Get the job details after updating
    const [jobResults] = await sequelize.query(
      `SELECT * FROM email_jobs WHERE id = ?`,
      {
        replacements: [nextJobId],
        transaction
      }
    );
    
    if (jobResults.length === 0) {
      await transaction.commit();
      return null;
    }
    
    const job = jobResults[0];
    
    // Process the job
    try {
      let jobData;
      try {
        // Check if job.data is already an object
        jobData = typeof job.data === 'object' ? job.data : JSON.parse(job.data);
      } catch (parseError) {
        throw new Error(`Invalid job data format: ${parseError.message}`);
      }
      
      switch (job.type) {
        case 'query-confirmation':
          await emailService.sendQueryConfirmation(jobData.query, jobData.companyDetails);
          break;
          
        case 'admin-notification':
          await emailService.sendNewQueryNotification(jobData.query, jobData.adminEmails, jobData.adminUrl);
          break;
          
        case 'document-expiry':
          await emailService.sendDocumentExpiryNotification(jobData.document, jobData.daysBefore);
          break;
          
        case 'quotation':
          const pdfBuffer = Buffer.from(jobData.pdfBuffer, 'base64');
          await emailService.sendQuotationEmail(jobData.quotation, pdfBuffer, jobData.companyDetails);
          break;
          
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
      
      // Mark job as completed
      await sequelize.query(
        `UPDATE email_jobs 
         SET status = 'completed', processed_at = NOW(), updated_at = NOW(), error = NULL
         WHERE id = ?`,
        {
          replacements: [job.id],
          transaction
        }
      );
      
      logger.info(`Email job ${job.id} of type ${job.type} processed successfully`);
    } catch (error) {
      // Mark job as failed if max attempts reached, otherwise it will be retried
      const newStatus = job.attempts >= job.max_attempts ? 'failed' : 'pending';
      
      await sequelize.query(
        `UPDATE email_jobs 
         SET status = ?, error = ?, updated_at = NOW() 
         WHERE id = ?`,
        {
          replacements: [newStatus, error.message, job.id],
          transaction
        }
      );
      
      logger.error(`Email job ${job.id} of type ${job.type} processing error:`, error);
    }
    
    await transaction.commit();
    return job;
  } catch (error) {
    await transaction.rollback();
    logger.error('Error in processNextJob:', error);
    return null;
  }
};

/**
 * Delete pending email jobs for a specific document
 * @param {number} documentId - Machine document ID
 * @returns {Promise<number>} - Number of deleted jobs
 */
const deleteDocumentExpiryJobs = async (documentId) => {
  try {
    const [result] = await sequelize.query(
      `DELETE FROM email_jobs 
       WHERE type = 'document-expiry' 
       AND status = 'pending'
       AND JSON_EXTRACT(data, '$.document.id') = ?`,
      {
        replacements: [documentId]
      }
    );
    
    if (result.affectedRows > 0) {
      logger.info(`Deleted ${result.affectedRows} pending document expiry jobs for document ID ${documentId}`);
    }
    
    return result.affectedRows;
  } catch (error) {
    logger.error(`Error deleting document expiry jobs for document ID ${documentId}:`, error);
    return 0;
  }
};

/**
 * Reset hung jobs that have been in 'processing' state for too long
 * @param {number} minutes - Number of minutes after which to reset jobs
 * @returns {Promise<number>} - Number of reset jobs
 */
const resetHungJobs = async (minutes = 15) => {
  try {
    const [result] = await sequelize.query(
      `UPDATE email_jobs 
       SET status = 'pending', updated_at = NOW() 
       WHERE status = 'processing' 
       AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      {
        replacements: [minutes]
      }
    );
    
    if (result.affectedRows > 0) {
      logger.info(`Reset ${result.affectedRows} hung email jobs`);
    }
    
    return result.affectedRows;
  } catch (error) {
    logger.error('Error resetting hung jobs:', error);
    return 0;
  }
};

/**
 * Get jobs statistics
 * @returns {Promise<Object>} - Statistics about the jobs
 */
const getJobStats = async () => {
  try {
    const [results] = await sequelize.query(
      `SELECT status, COUNT(*) as count FROM email_jobs GROUP BY status`
    );
    
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
    
    results.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });
    
    return stats;
  } catch (error) {
    logger.error('Error getting job stats:', error);
    return null;
  }
};

/**
 * Retry failed jobs
 * @param {number} limit - Maximum number of jobs to retry
 * @returns {Promise<number>} - Number of jobs reset for retry
 */
const retryFailedJobs = async (limit = 10) => {
  try {
    const [result] = await sequelize.query(
      `UPDATE email_jobs 
       SET status = 'pending', attempts = 0, updated_at = NOW(), error = NULL 
       WHERE status = 'failed' 
       LIMIT ?`,
      {
        replacements: [limit]
      }
    );
    
    if (result.affectedRows > 0) {
      logger.info(`Reset ${result.affectedRows} failed jobs for retry`);
    }
    
    return result.affectedRows;
  } catch (error) {
    logger.error('Error retrying failed jobs:', error);
    return 0;
  }
};

module.exports = {
  createEmailJob,
  processNextJob,
  deleteDocumentExpiryJobs,
  resetHungJobs,
  getJobStats,
  retryFailedJobs
};