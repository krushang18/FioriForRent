const BaseController = require('./baseController');
const { Machine } = require('../models');
const { Op } = require('sequelize');
const cloudinaryService = require('../services/cloudinaryService');
const path = require('path');

class MachineController extends BaseController {
  constructor() {
    super(Machine);
  }

  /**
   * Get all machines with optional filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllMachines = async (req, res) => {
    try {
      const { active, search } = req.query;
      
      // Build query conditions
      const whereConditions = {};
      
      if (active !== undefined) {
        whereConditions.is_active = active === 'true';
      }
      
      if (search) {
        whereConditions[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }
      
      const machines = await Machine.findAll({
        where: whereConditions,
        order: [['name', 'ASC']]
      });
      
      res.status(200).json({
        status: 'success',
        data: machines
      });
    } catch (error) {
      console.error('Error in getAllMachines:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch machines',
        error: error.message
      });
    }
  };

  /**
   * Create a new machine with image upload
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createMachine = async (req, res) => {
    try {
      const { name, description, price, gst_percentage, is_active } = req.body;
      
      // Initialize machine data
      const machineData = {
        name,
        description,
        price,
        gst_percentage: gst_percentage || 18.00,
        is_active: is_active !== undefined ? is_active : true
      };
      
      // Handle image upload if present
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileExtension = path.extname(req.file.originalname);
        
        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          fileBuffer,
          'machines',
          {
            public_id: `machine_${Date.now()}${fileExtension}`,
            resource_type: 'image'
          }
        );
        
        // Add image URL to machine data
        machineData.image_url = uploadResult.secure_url;
      }
      
      // Create the machine
      const machine = await Machine.create(machineData);
      
      res.status(201).json({
        status: 'success',
        message: 'Machine created successfully',
        data: machine
      });
    } catch (error) {
      console.error('Error in createMachine:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create machine',
        error: error.message
      });
    }
  };

  /**
   * Update a machine with optional image update
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateMachine = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, gst_percentage, is_active } = req.body;
      
      // Find the machine
      const machine = await Machine.findByPk(id);
      
      if (!machine) {
        return res.status(404).json({
          status: 'error',
          message: 'Machine not found'
        });
      }
      
      // Initialize update data
      const updateData = {
        name: name || machine.name,
        description: description !== undefined ? description : machine.description,
        price: price || machine.price,
        gst_percentage: gst_percentage || machine.gst_percentage,
        is_active: is_active !== undefined ? is_active : machine.is_active
      };
      
      // Handle image upload if present
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileExtension = path.extname(req.file.originalname);
        
        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          fileBuffer,
          'machines',
          {
            public_id: `machine_${Date.now()}${fileExtension}`,
            resource_type: 'image'
          }
        );
        
        // Add image URL to update data
        updateData.image_url = uploadResult.secure_url;
        
        // Delete old image if exists
        if (machine.image_url) {
          // Extract public ID from URL
          const publicId = machine.image_url.split('/').pop().split('.')[0];
          try {
            await cloudinaryService.deleteFile(`machines/${publicId}`);
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
            // Continue with update even if image deletion fails
          }
        }
      }
      
      // Update the machine
      await machine.update(updateData);
      
      res.status(200).json({
        status: 'success',
        message: 'Machine updated successfully',
        data: machine
      });
    } catch (error) {
      console.error('Error in updateMachine:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update machine',
        error: error.message
      });
    }
  };

  /**
   * Delete a machine and its image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteMachine = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the machine
      const machine = await Machine.findByPk(id);
      
      if (!machine) {
        return res.status(404).json({
          status: 'error',
          message: 'Machine not found'
        });
      }
      
      // Delete image from Cloudinary if exists
      if (machine.image_url) {
        // Extract public ID from URL
        const publicId = machine.image_url.split('/').pop().split('.')[0];
        try {
          await cloudinaryService.deleteFile(`machines/${publicId}`);
        } catch (deleteError) {
          console.error('Error deleting image:', deleteError);
          // Continue with deletion even if image deletion fails
        }
      }
      
      // Delete the machine
      await machine.destroy();
      
      res.status(200).json({
        status: 'success',
        message: 'Machine deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteMachine:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete machine',
        error: error.message
      });
    }
  };

  /**
   * Toggle machine active status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  toggleActive = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the machine
      const machine = await Machine.findByPk(id);
      
      if (!machine) {
        return res.status(404).json({
          status: 'error',
          message: 'Machine not found'
        });
      }
      
      // Toggle active status
      machine.is_active = !machine.is_active;
      await machine.save();
      
      res.status(200).json({
        status: 'success',
        message: `Machine is now ${machine.is_active ? 'active' : 'inactive'}`,
        data: machine
      });
    } catch (error) {
      console.error('Error in toggleActive:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to toggle machine status',
        error: error.message
      });
    }
  };
}

module.exports = new MachineController();