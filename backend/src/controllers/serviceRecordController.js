const BaseController = require('./baseController');
const { 
  ServiceRecord, 
  ServiceDescriptionItem, 
  ServiceRecordDetail, 
  Machine, 
  User, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

class ServiceRecordController extends BaseController {
  constructor() {
    super(ServiceRecord);
  }

  /**
   * Get all service records with optional filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllServiceRecords = async (req, res) => {
    try {
      const { machine_id, startDate, endDate, search } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      const includeOptions = [
        {
          model: Machine,
          as: 'machine',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: ServiceRecordDetail,
          as: 'details',
          include: [
            {
              model: ServiceDescriptionItem,
              as: 'descriptionItem'
            }
          ]
        }
      ];
      
      if (machine_id) {
        whereConditions.machine_id = machine_id;
      }
      
      // Filter by date range
      if (startDate && endDate) {
        whereConditions.service_date = {
          [Op.between]: [
            moment(startDate).startOf('day').toDate(),
            moment(endDate).endOf('day').toDate()
          ]
        };
      } else if (startDate) {
        whereConditions.service_date = {
          [Op.gte]: moment(startDate).startOf('day').toDate()
        };
      } else if (endDate) {
        whereConditions.service_date = {
          [Op.lte]: moment(endDate).endOf('day').toDate()
        };
      }
      
      // Search in operator or site_location
      if (search) {
        whereConditions[Op.or] = [
          { operator: { [Op.like]: `%${search}%` } },
          { site_location: { [Op.like]: `%${search}%` } }
        ];
      }
      
      const serviceRecords = await ServiceRecord.findAll({
        where: whereConditions,
        include: includeOptions,
        order: [['service_date', 'DESC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: serviceRecords
      });
    } catch (error) {
      console.error('Error in getAllServiceRecords:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch service records',
        error: error.message
      });
    }
  };

  /**
   * Get recent service records for dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getRecentServiceRecords = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit || 5);
      
      const serviceRecords = await ServiceRecord.findAll({
        include: [
          {
            model: Machine,
            as: 'machine',
            attributes: ['id', 'name']
          }
        ],
        order: [['service_date', 'DESC']],
        limit
      });
      
      res.status(200).json({
        status: 'success',
        data: serviceRecords
      });
    } catch (error) {
      console.error('Error in getRecentServiceRecords:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch recent service records',
        error: error.message
      });
    }
  };

  /**
   * Get service record by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getServiceRecordById = async (req, res) => {
    try {
      const { id } = req.params;
      
      const serviceRecord = await ServiceRecord.findByPk(id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: ServiceRecordDetail,
            as: 'details',
            include: [
              {
                model: ServiceDescriptionItem,
                as: 'descriptionItem'
              }
            ]
          }
        ]
      });
      
      if (!serviceRecord) {
        return res.status(404).json({
          status: 'error',
          message: 'Service record not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: serviceRecord
      });
    } catch (error) {
      console.error('Error in getServiceRecordById:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch service record',
        error: error.message
      });
    }
  };

  /**
   * Create a new service record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createServiceRecord = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { 
        machine_id, 
        service_date, 
        engine_hours, 
        site_location, 
        operator, 
        description_items 
      } = req.body;
      
      // Validate required fields
      if (!machine_id || !service_date) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Machine ID and service date are required'
        });
      }
      
      // Create service record
      const serviceRecord = await ServiceRecord.create({
        machine_id,
        service_date,
        engine_hours: engine_hours || null,
        site_location: site_location || null,
        operator: operator || null,
        created_by: req.userId // From auth middleware
      }, { transaction });
      
      // Handle description items
      if (description_items && Array.isArray(description_items) && description_items.length > 0) {
        // Process each description item
        for (const item of description_items) {
          let descriptionItemId;
          
          // Check if it's an existing item or new
          if (item.id) {
            // Use existing item
            descriptionItemId = item.id;
          } else if (item.description) {
            // Create new description item
            const newItem = await ServiceDescriptionItem.create({
              description: item.description
            }, { transaction });
            
            descriptionItemId = newItem.id;
          } else {
            // Skip if no valid data
            continue;
          }
          
          // Create service record detail
          await ServiceRecordDetail.create({
            service_record_id: serviceRecord.id,
            description_item_id: descriptionItemId,
            custom_description: item.custom_description || null
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      // Fetch the created service record with details
      const createdServiceRecord = await ServiceRecord.findByPk(serviceRecord.id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: ServiceRecordDetail,
            as: 'details',
            include: [
              {
                model: ServiceDescriptionItem,
                as: 'descriptionItem'
              }
            ]
          }
        ]
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Service record created successfully',
        data: createdServiceRecord
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in createServiceRecord:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create service record',
        error: error.message
      });
    }
  };

  /**
   * Update a service record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateServiceRecord = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        service_date, 
        engine_hours, 
        site_location, 
        operator, 
        description_items 
      } = req.body;
      
      // Find the service record
      const serviceRecord = await ServiceRecord.findByPk(id);
      
      if (!serviceRecord) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Service record not found'
        });
      }
      
      // Update service record
      await serviceRecord.update({
        service_date: service_date || serviceRecord.service_date,
        engine_hours: engine_hours !== undefined ? engine_hours : serviceRecord.engine_hours,
        site_location: site_location !== undefined ? site_location : serviceRecord.site_location,
        operator: operator !== undefined ? operator : serviceRecord.operator
      }, { transaction });
      
      // Update description items if provided
      if (description_items && Array.isArray(description_items)) {
        // Remove existing details
        await ServiceRecordDetail.destroy({
          where: { service_record_id: id },
          transaction
        });
        
        // Process each description item
        for (const item of description_items) {
          let descriptionItemId;
          
          // Check if it's an existing item or new
          if (item.id) {
            // Use existing item
            descriptionItemId = item.id;
          } else if (item.description) {
            // Create new description item
            const newItem = await ServiceDescriptionItem.create({
              description: item.description
            }, { transaction });
            
            descriptionItemId = newItem.id;
          } else {
            // Skip if no valid data
            continue;
          }
          
          // Create service record detail
          await ServiceRecordDetail.create({
            service_record_id: serviceRecord.id,
            description_item_id: descriptionItemId,
            custom_description: item.custom_description || null
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      // Fetch the updated service record with details
      const updatedServiceRecord = await ServiceRecord.findByPk(id, {
        include: [
          {
            model: Machine,
            as: 'machine'
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          },
          {
            model: ServiceRecordDetail,
            as: 'details',
            include: [
              {
                model: ServiceDescriptionItem,
                as: 'descriptionItem'
              }
            ]
          }
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Service record updated successfully',
        data: updatedServiceRecord
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in updateServiceRecord:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update service record',
        error: error.message
      });
    }
  };

  /**
   * Delete a service record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteServiceRecord = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the service record
      const serviceRecord = await ServiceRecord.findByPk(id);
      
      if (!serviceRecord) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Service record not found'
        });
      }
      
      // Delete service record details first
      await ServiceRecordDetail.destroy({
        where: { service_record_id: id },
        transaction
      });
      
      // Delete service record
      await serviceRecord.destroy({ transaction });
      
      await transaction.commit();
      
      res.status(200).json({
        status: 'success',
        message: 'Service record deleted successfully'
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in deleteServiceRecord:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete service record',
        error: error.message
      });
    }
  };

  /**
   * Get all service description items
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllDescriptionItems = async (req, res) => {
    try {
      const items = await ServiceDescriptionItem.findAll({
        order: [['description', 'ASC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: items
      });
    } catch (error) {
      console.error('Error in getAllDescriptionItems:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch service description items',
        error: error.message
      });
    }
  };

  /**
   * Create a new service description item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createDescriptionItem = async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description) {
        return res.status(400).json({
          status: 'error',
          message: 'Description is required'
        });
      }
      
      // Check if item already exists
      const existingItem = await ServiceDescriptionItem.findOne({
        where: {
          description: {
            [Op.like]: description
          }
        }
      });
      
      if (existingItem) {
        return res.status(400).json({
          status: 'error',
          message: 'A similar description item already exists'
        });
      }
      
      const item = await ServiceDescriptionItem.create({
        description
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Description item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Error in createDescriptionItem:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create description item',
        error: error.message
      });
    }
  };

  /**
   * Delete a service description item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteDescriptionItem = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if the item is used in any service records
      const usageCount = await ServiceRecordDetail.count({
        where: { description_item_id: id }
      });
      
      if (usageCount > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot delete: this item is used in ${usageCount} service records`
        });
      }
      
      const result = await ServiceDescriptionItem.destroy({
        where: { id }
      });
      
      if (result === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Description item not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Description item deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteDescriptionItem:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete description item',
        error: error.message
      });
    }
  };
}

module.exports = new ServiceRecordController();