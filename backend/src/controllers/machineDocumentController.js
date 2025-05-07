const BaseController = require('./baseController');
const { 
  MachineDocument, 
  DocumentNotification, 
  Machine, 
  DocumentNotificationLog, 
  User,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const emailJobService = require('../services/emailJobService');
const logger = require('../utils/logger');

class MachineDocumentController extends BaseController {
  constructor() {
    super(MachineDocument);
  }

  /**
   * Get all machine documents with optional filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllDocuments = async (req, res) => {
    try {
      const { machine_id, document_type, expiring_within_days } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      const includeOptions = [
        {
          model: Machine,
          as: 'machine',
          attributes: ['id', 'name']
        },
        {
          model: DocumentNotification,
          as: 'notifications'
        }
      ];
      
      if (machine_id) {
        whereConditions.machine_id = machine_id;
      }
      
      if (document_type) {
        whereConditions.document_type = document_type;
      }
      
      // Filter documents expiring within X days
      if (expiring_within_days) {
        const futureDate = moment().add(parseInt(expiring_within_days), 'days').toDate();
        whereConditions.expiry_date = {
          [Op.lte]: futureDate,
          [Op.gte]: moment().toDate() // Only include non-expired documents
        };
      }
      
      const documents = await MachineDocument.findAll({
        where: whereConditions,
        include: includeOptions,
        order: [['expiry_date', 'ASC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: documents
      });
    } catch (error) {
      console.error('Error in getAllDocuments:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch machine documents',
        error: error.message
      });
    }
  };

  /**
   * Get documents expiring soon for dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getExpiringDocuments = async (req, res) => {
    try {
      const days = parseInt(req.query.days || 30);
      const futureDate = moment().add(days, 'days').toDate();
      
      const documents = await MachineDocument.findAll({
        where: {
          expiry_date: {
            [Op.lte]: futureDate,
            [Op.gte]: moment().toDate()
          }
        },
        include: [
          {
            model: Machine,
            as: 'machine',
            attributes: ['id', 'name']
          }
        ],
        order: [['expiry_date', 'ASC']],
        limit: 10
      });
      
      res.status(200).json({
        status: 'success',
        data: documents
      });
    } catch (error) {
      console.error('Error in getExpiringDocuments:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch expiring documents',
        error: error.message
      });
    }
  };

  /**
   * Get a document by ID with notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getDocumentById = async (req, res) => {
    try {
      const { id } = req.params;
      
      const document = await MachineDocument.findByPk(id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: DocumentNotification,
            as: 'notifications',
            order: [['days_before', 'DESC']]
          }
        ]
      });
      
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Document not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: document
      });
    } catch (error) {
      console.error('Error in getDocumentById:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch document',
        error: error.message
      });
    }
  };

  /**
   * Schedule notifications for a document
   * @param {Object} document - Machine document with notifications
   * @param {Array} adminEmails - List of admin email addresses
   * @returns {Promise<void>}
   */
  scheduleDocumentNotifications = async (document, adminEmails) => {
    try {
      const expiryDate = moment(document.expiry_date);
      const today = moment().startOf('day');
      const plainDocument = document.get({ plain: true });
      
      // Schedule notifications for each notification setting
      for (const notification of document.notifications) {
        if (!notification.is_active) continue;
        
        const notificationDate = moment(expiryDate).subtract(notification.days_before, 'days');
        
        // Skip if notification date is in the past
        if (notificationDate.isBefore(today)) {
          continue;
        }
        
        // Check if notification is already logged
        const existingLog = await DocumentNotificationLog.findOne({
          where: {
            machine_document_id: document.id,
            days_before: notification.days_before,
            notification_date: notificationDate.format('YYYY-MM-DD')
          }
        });
        
        if (existingLog) {
          logger.info(`Notification for document ID ${document.id} at ${notification.days_before} days already scheduled`);
          continue;
        }
        
        // Create email job with scheduled date
        await emailJobService.createEmailJob(
          'document-expiry',
          {
            document: plainDocument,
            daysBefore: notification.days_before,
            adminEmails
          },
          notificationDate.toDate()
        );
        
        // Log the scheduled notification
        await DocumentNotificationLog.create({
          machine_document_id: document.id,
          days_before: notification.days_before,
          notification_date: notificationDate.format('YYYY-MM-DD')
        });
        
        logger.info(`Scheduled notification for document ID ${document.id} at ${notification.days_before} days before expiry`);
      }
    } catch (error) {
      logger.error(`Error scheduling notifications for document ID ${document.id}:`, error);
      throw error;
    }
  };

  /**
   * Create a new machine document with notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createDocument = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { machine_id, document_type, expiry_date, last_renewed_date, remarks, notifications } = req.body;
      
      // Validate required fields
      if (!machine_id || !document_type || !expiry_date) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Machine ID, document type, and expiry date are required'
        });
      }
      
      // Check for existing document of the same type for this machine
      const existingDocument = await MachineDocument.findOne({
        where: {
          machine_id,
          document_type
        }
      });
      
      if (existingDocument) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: `A ${document_type} document already exists for this machine`
        });
      }
      
      // Create document
      const document = await MachineDocument.create({
        machine_id,
        document_type,
        expiry_date,
        last_renewed_date: last_renewed_date || null,
        remarks: remarks || null
      }, { transaction });
      
      // Create notifications if provided
      if (notifications && Array.isArray(notifications) && notifications.length > 0) {
        await Promise.all(notifications.map(days_before => 
          DocumentNotification.create({
            machine_document_id: document.id,
            days_before: parseInt(days_before),
            is_active: true
          }, { transaction })
        ));
      } else {
        // Create default notifications (14, 7, 3, and 1 day)
        const defaultDays = [14, 7, 3, 1, 0]; // Added 0 for same day notification
        await Promise.all(defaultDays.map(days_before => 
          DocumentNotification.create({
            machine_document_id: document.id,
            days_before,
            is_active: true
          }, { transaction })
        ));
      }
      
      await transaction.commit();
      
      // Fetch the created document with notifications
      const createdDocument = await MachineDocument.findByPk(document.id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: DocumentNotification,
            as: 'notifications'
          }
        ]
      });
      
      // Get admin emails for notifications
      const adminUsers = await User.findAll();
      const adminEmails = adminUsers.map(user => user.email);
      
      // Schedule notifications
      await this.scheduleDocumentNotifications(createdDocument, adminEmails);
      
      res.status(201).json({
        status: 'success',
        message: 'Document created successfully',
        data: createdDocument
      });
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      console.error('Error in createDocument:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create document',
        error: error.message
      });
    }
  };

  /**
   * Update a machine document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateDocument = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { expiry_date, last_renewed_date, remarks, notifications } = req.body;
      
      // Find the document
      const document = await MachineDocument.findByPk(id);
      
      if (!document) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Document not found'
        });
      }
      
      // Check if expiry date is changing
      const expiryDateChanged = expiry_date && moment(expiry_date).format('YYYY-MM-DD') !== moment(document.expiry_date).format('YYYY-MM-DD');
      
      // Update document
      await document.update({
        expiry_date: expiry_date || document.expiry_date,
        last_renewed_date: last_renewed_date || document.last_renewed_date,
        remarks: remarks !== undefined ? remarks : document.remarks
      }, { transaction });
      
      // Update notifications if provided
      if (notifications && Array.isArray(notifications)) {
        // First, delete existing notifications
        await DocumentNotification.destroy({
          where: { machine_document_id: document.id },
          transaction
        });
        
        // Create new notifications
        await Promise.all(notifications.map(days_before => 
          DocumentNotification.create({
            machine_document_id: document.id,
            days_before: parseInt(days_before),
            is_active: true
          }, { transaction })
        ));
      }
      
      await transaction.commit();
      
      // If expiry date changed or notifications updated, reschedule notifications
      if (expiryDateChanged || notifications) {
        // Delete existing pending jobs
        await emailJobService.deleteDocumentExpiryJobs(document.id);
        
        // Delete notification logs
        await DocumentNotificationLog.destroy({
          where: { machine_document_id: document.id }
        });
        
        // Fetch the updated document with notifications
        const updatedDocument = await MachineDocument.findByPk(document.id, {
          include: [
            {
              model: Machine,
              as: 'machine'
            },
            {
              model: DocumentNotification,
              as: 'notifications'
            }
          ]
        });
        
        // Get admin emails for notifications
        const adminUsers = await User.findAll();
        const adminEmails = adminUsers.map(user => user.email);
        
        // Schedule new notifications
        await this.scheduleDocumentNotifications(updatedDocument, adminEmails);
      }
      
      // Fetch the final updated document
      const finalDocument = await MachineDocument.findByPk(document.id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: DocumentNotification,
            as: 'notifications'
          }
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Document updated successfully',
        data: finalDocument
      });
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      console.error('Error in updateDocument:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update document',
        error: error.message
      });
    }
  };

  /**
   * Delete a machine document
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteDocument = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the document
      const document = await MachineDocument.findByPk(id);
      
      if (!document) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Document not found'
        });
      }
      
      // Delete notifications first (should cascade, but just to be safe)
      await DocumentNotification.destroy({
        where: { machine_document_id: document.id },
        transaction
      });
      
      // Delete document
      await document.destroy({ transaction });
      
      await transaction.commit();
      
      // Delete any pending notification jobs
      await emailJobService.deleteDocumentExpiryJobs(id);
      
      // Delete notification logs
      await DocumentNotificationLog.destroy({
        where: { machine_document_id: id }
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Document deleted successfully'
      });
    } catch (error) {
      if (transaction.finished !== 'commit') {
        await transaction.rollback();
      }
      console.error('Error in deleteDocument:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete document',
        error: error.message
      });
    }
  };

  /**
   * Check for missing document notifications and schedule them
   * This method ensures we don't miss notifications if a document was created when scheduler was down
   */
  checkMissingNotifications = async () => {
    try {
      // Get all active documents with their notifications
      const documents = await MachineDocument.findAll({
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: DocumentNotification,
            as: 'notifications',
            where: {
              is_active: true
            }
          }
        ]
      });
      
      // Get admin emails
      const adminUsers = await User.findAll();
      const adminEmails = adminUsers.map(user => user.email);
      
      let scheduledCount = 0;
      
      // Process each document
      for (const document of documents) {
        await this.scheduleDocumentNotifications(document, adminEmails);
        scheduledCount++;
      }
      
      logger.info(`Checked notifications for ${documents.length} documents`);
      return { success: true, scheduledCount };
    } catch (error) {
      logger.error('Error in checkMissingNotifications:', error);
      return { success: false, error: error.message };
    }
  };
}

module.exports = new MachineDocumentController();