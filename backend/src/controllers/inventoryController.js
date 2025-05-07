const BaseController = require('./baseController');
const { 
  InventoryItem, 
  InventoryBatch, 
  InventoryTransaction, 
  User, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const cloudinaryService = require('../services/cloudinaryService');
const path = require('path');

class InventoryController extends BaseController {
  constructor() {
    super(InventoryItem);
  }

  /**
   * Get all inventory items with batches and quantity information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllInventoryItems = async (req, res) => {
    try {
      const { search, low_stock } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      
      if (search) {
        whereConditions[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }
      
      const items = await InventoryItem.findAll({
        where: whereConditions,
        include: [
          {
            model: InventoryBatch,
            as: 'batches',
            attributes: ['id', 'batch_identifier', 'purchase_date', 'unit_price', 'initial_quantity', 'current_quantity']
          }
        ],
        order: [['name', 'ASC']]
      });
      
      // Calculate total quantities and filter if low_stock parameter is provided
      const processedItems = items.map(item => {
        const itemData = item.get({ plain: true });
        
        // Calculate total quantity across all batches
        const totalQuantity = itemData.batches.reduce((sum, batch) => sum + batch.current_quantity, 0);
        
        // Add total quantity to item
        return {
          ...itemData,
          total_quantity: totalQuantity
        };
      });
      
      // Filter low stock items if requested
      let resultItems = processedItems;
      if (low_stock === 'true') {
        // Define low stock threshold (e.g., less than 10 units)
        const LOW_STOCK_THRESHOLD = 10;
        resultItems = processedItems.filter(item => item.total_quantity < LOW_STOCK_THRESHOLD);
      }
      
      res.status(200).json({
        status: 'success',
        data: resultItems
      });
    } catch (error) {
      console.error('Error in getAllInventoryItems:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch inventory items',
        error: error.message
      });
    }
  };

  /**
   * Get low stock items for dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLowStockItems = async (req, res) => {
    try {
      const LOW_STOCK_THRESHOLD = parseInt(req.query.threshold || 10);
      
      const items = await InventoryItem.findAll({
        include: [
          {
            model: InventoryBatch,
            as: 'batches',
            attributes: ['current_quantity']
          }
        ]
      });
      
      // Filter and process items
      const lowStockItems = items
        .map(item => {
          const itemData = item.get({ plain: true });
          
          // Calculate total quantity
          const totalQuantity = itemData.batches.reduce((sum, batch) => sum + batch.current_quantity, 0);
          
          return {
            ...itemData,
            total_quantity: totalQuantity
          };
        })
        .filter(item => item.total_quantity < LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.total_quantity - b.total_quantity); // Sort by lowest stock first
      
      res.status(200).json({
        status: 'success',
        data: lowStockItems
      });
    } catch (error) {
      console.error('Error in getLowStockItems:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock items',
        error: error.message
      });
    }
  };

  /**
   * Get an inventory item by ID with batches and transactions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getInventoryItemById = async (req, res) => {
    try {
      const { id } = req.params;
      
      const item = await InventoryItem.findByPk(id, {
        include: [
          {
            model: InventoryBatch,
            as: 'batches',
            include: [
              {
                model: InventoryTransaction,
                as: 'transactions',
                include: [
                  {
                    model: User,
                    as: 'performer',
                    attributes: ['id', 'username']
                  }
                ]
              }
            ]
          }
        ]
      });
      
      if (!item) {
        return res.status(404).json({
          status: 'error',
          message: 'Inventory item not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: item
      });
    } catch (error) {
      console.error('Error in getInventoryItemById:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch inventory item',
        error: error.message
      });
    }
  };

  /**
   * Create a new inventory item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createInventoryItem = async (req, res) => {
    try {
      const { name, description, initial_quantity, unit_price, batch_identifier, purchase_date } = req.body;
      
      // Validate required fields
      if (!name || initial_quantity === undefined || unit_price === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Name, initial quantity, and unit price are required'
        });
      }
      
      // Initialize item data
      const itemData = {
        name,
        description: description || null
      };
      
      // Handle image upload if present
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileExtension = path.extname(req.file.originalname);
        
        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          fileBuffer,
          'inventory',
          {
            public_id: `inventory_${Date.now()}${fileExtension}`,
            resource_type: 'image'
          }
        );
        
        // Add image URL to item data
        itemData.image_url = uploadResult.secure_url;
      }
      
      // Start transaction
      const transaction = await sequelize.transaction();
      
      try {
        // Create item
        const item = await InventoryItem.create(itemData, { transaction });
        
        // Create initial batch
        const batch = await InventoryBatch.create({
          item_id: item.id,
          batch_identifier: batch_identifier || `BATCH-${Date.now()}`,
          purchase_date: purchase_date || new Date(),
          unit_price: parseFloat(unit_price),
          initial_quantity: parseInt(initial_quantity),
          current_quantity: parseInt(initial_quantity)
        }, { transaction });
        
        // Create initial transaction record (stock in)
        await InventoryTransaction.create({
          batch_id: batch.id,
          transaction_type: 'IN',
          quantity: parseInt(initial_quantity),
          reference_note: 'Initial stock',
          performed_by: req.userId // From auth middleware
        }, { transaction });
        
        await transaction.commit();
        
        // Fetch the created item with its batch
        const createdItem = await InventoryItem.findByPk(item.id, {
          include: [
            {
              model: InventoryBatch,
              as: 'batches'
            }
          ]
        });
        
        res.status(201).json({
          status: 'success',
          message: 'Inventory item created successfully',
          data: createdItem
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error in createInventoryItem:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create inventory item',
        error: error.message
      });
    }
  };

  /**
   * Update an inventory item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateInventoryItem = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      // Find the item
      const item = await InventoryItem.findByPk(id);
      
      if (!item) {
        return res.status(404).json({
          status: 'error',
          message: 'Inventory item not found'
        });
      }
      
      // Update item data
      const updateData = {
        name: name || item.name,
        description: description !== undefined ? description : item.description
      };
      
      // Handle image upload if present
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileExtension = path.extname(req.file.originalname);
        
        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          fileBuffer,
          'inventory',
          {
            public_id: `inventory_${Date.now()}${fileExtension}`,
            resource_type: 'image'
          }
        );
        
        // Add image URL to update data
        updateData.image_url = uploadResult.secure_url;
        
        // Delete old image if exists
        if (item.image_url) {
          // Extract public ID from URL
          const publicId = item.image_url.split('/').pop().split('.')[0];
          try {
            await cloudinaryService.deleteFile(`inventory/${publicId}`);
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
            // Continue with update even if image deletion fails
          }
        }
      }
      
      // Update the item
      await item.update(updateData);
      
      // Fetch the updated item with its batches
      const updatedItem = await InventoryItem.findByPk(id, {
        include: [
          {
            model: InventoryBatch,
            as: 'batches'
          }
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: 'Inventory item updated successfully',
        data: updatedItem
      });
    } catch (error) {
      console.error('Error in updateInventoryItem:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update inventory item',
        error: error.message
      });
    }
  };

  /**
   * Delete an inventory item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteInventoryItem = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the item
      const item = await InventoryItem.findByPk(id, {
        include: [
          {
            model: InventoryBatch,
            as: 'batches'
          }
        ]
      });
      
      if (!item) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Inventory item not found'
        });
      }
      
      // Check if item has batches with transactions
      if (item.batches && item.batches.length > 0) {
        // Check if any batch has transactions
        for (const batch of item.batches) {
          const transactionCount = await InventoryTransaction.count({
            where: { batch_id: batch.id }
          });
          
          if (transactionCount > 1) { // More than initial stock-in transaction
            await transaction.rollback();
            return res.status(400).json({
              status: 'error',
              message: 'Cannot delete: this item has transaction history'
            });
          }
        }
        
        // Delete batches and their initial transactions
        for (const batch of item.batches) {
          // Delete transactions first
          await InventoryTransaction.destroy({
            where: { batch_id: batch.id },
            transaction
          });
          
          // Delete batch
          await batch.destroy({ transaction });
        }
      }
      
      // Delete image from Cloudinary if exists
      if (item.image_url) {
        // Extract public ID from URL
        const publicId = item.image_url.split('/').pop().split('.')[0];
        try {
          await cloudinaryService.deleteFile(`inventory/${publicId}`);
        } catch (deleteError) {
          console.error('Error deleting image:', deleteError);
          // Continue with deletion even if image deletion fails
        }
      }
      
      // Delete the item
      await item.destroy({ transaction });
      
      await transaction.commit();
      
      res.status(200).json({
        status: 'success',
        message: 'Inventory item deleted successfully'
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in deleteInventoryItem:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete inventory item',
        error: error.message
      });
    }
  };

  /**
   * Add a new batch of the item
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  addBatch = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { batch_identifier, purchase_date, unit_price, quantity, reference_note } = req.body;
      
      // Validate required fields
      if (unit_price === undefined || quantity === undefined) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Unit price and quantity are required'
        });
      }
      
      // Check if item exists
      const item = await InventoryItem.findByPk(id);
      
      if (!item) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Inventory item not found'
        });
      }
      
      // Create new batch
      const batch = await InventoryBatch.create({
        item_id: id,
        batch_identifier: batch_identifier || `BATCH-${Date.now()}`,
        purchase_date: purchase_date || new Date(),
        unit_price: parseFloat(unit_price),
        initial_quantity: parseInt(quantity),
        current_quantity: parseInt(quantity)
      }, { transaction });
      
      // Create transaction record (stock in)
      await InventoryTransaction.create({
        batch_id: batch.id,
        transaction_type: 'IN',
        quantity: parseInt(quantity),
        reference_note: reference_note || 'New stock batch',
        performed_by: req.userId // From auth middleware
      }, { transaction });
      
      await transaction.commit();
      
      // Fetch the updated item with all batches
      const updatedItem = await InventoryItem.findByPk(id, {
        include: [
          {
            model: InventoryBatch,
            as: 'batches'
          }
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: 'New batch added successfully',
        data: updatedItem
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in addBatch:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to add new batch',
        error: error.message
      });
    }
  };

  /**
   * Record an inventory transaction (IN, OUT, RETURN)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  recordTransaction = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { batch_id, transaction_type, quantity, reference_note } = req.body;
      
      // Validate required fields
      if (!batch_id || !transaction_type || quantity === undefined) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Batch ID, transaction type, and quantity are required'
        });
      }
      
      // Validate transaction type
      if (!['IN', 'OUT', 'RETURN'].includes(transaction_type)) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Transaction type must be IN, OUT, or RETURN'
        });
      }
      
      // Find the batch
      const batch = await InventoryBatch.findByPk(batch_id);
      
      if (!batch) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found'
        });
      }
      
      // Calculate new quantity
      const parsedQuantity = parseInt(quantity);
      let newQuantity;
      
      if (transaction_type === 'OUT') {
        // For OUT, subtract from current quantity
        newQuantity = batch.current_quantity - parsedQuantity;
        
        // Check if sufficient stock
        if (newQuantity < 0) {
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: `Insufficient stock. Available: ${batch.current_quantity}`
          });
        }
      } else {
        // For IN or RETURN, add to current quantity
        newQuantity = batch.current_quantity + parsedQuantity;
      }
      
      // Update batch quantity
      await batch.update({
        current_quantity: newQuantity
      }, { transaction });
      
      // Create transaction record
      const inventoryTransaction = await InventoryTransaction.create({
        batch_id,
        transaction_type,
        quantity: parsedQuantity,
        reference_note: reference_note || null,
        performed_by: req.userId // From auth middleware
      }, { transaction });
      
      await transaction.commit();
      
      // Fetch the updated batch with its item
      const updatedBatch = await InventoryBatch.findByPk(batch_id, {
        include: [
          {
            model: InventoryItem,
            as: 'item'
          },
          {
            model: InventoryTransaction,
            as: 'transactions',
            limit: 1,
            order: [['transaction_date', 'DESC']],
            include: [
              {
                model: User,
                as: 'performer',
                attributes: ['id', 'username']
              }
            ]
          }
        ]
      });
      
      res.status(200).json({
        status: 'success',
        message: `Inventory ${transaction_type.toLowerCase()} recorded successfully`,
        data: updatedBatch
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error in recordTransaction:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to record inventory transaction',
        error: error.message
      });
    }
  };

  /**
   * Get transaction history for a batch
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getBatchTransactions = async (req, res) => {
    try {
      const { batchId } = req.params;
      
      const transactions = await InventoryTransaction.findAll({
        where: { batch_id: batchId },
        include: [
          {
            model: User,
            as: 'performer',
            attributes: ['id', 'username']
          }
        ],
        order: [['transaction_date', 'DESC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: transactions
      });
    } catch (error) {
      console.error('Error in getBatchTransactions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch batch transactions',
        error: error.message
      });
    }
  };
}

module.exports = new InventoryController();