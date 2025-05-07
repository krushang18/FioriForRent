/**
 * Base controller with common CRUD operations
 */
class BaseController {
    /**
     * Constructor
     * @param {Object} model - Sequelize model
     */
    constructor(model) {
      this.model = model;
    }
  
    /**
     * Get all records
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    getAll = async (req, res) => {
      try {
        const items = await this.model.findAll();
        res.status(200).json(items);
      } catch (error) {
        console.error(`Error in ${this.model.name}.getAll:`, error);
        res.status(500).json({
          status: 'error',
          message: 'Failed to fetch records',
          error: error.message
        });
      }
    };
  
    /**
     * Get a record by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    getById = async (req, res) => {
      try {
        const item = await this.model.findByPk(req.params.id);
        if (!item) {
          return res.status(404).json({
            status: 'error',
            message: `${this.model.name} not found`
          });
        }
        res.status(200).json(item);
      } catch (error) {
        console.error(`Error in ${this.model.name}.getById:`, error);
        res.status(500).json({
          status: 'error',
          message: 'Failed to fetch record',
          error: error.message
        });
      }
    };
  
    /**
     * Create a new record
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    create = async (req, res) => {
      try {
        const item = await this.model.create(req.body);
        res.status(201).json({
          status: 'success',
          message: `${this.model.name} created successfully`,
          data: item
        });
      } catch (error) {
        console.error(`Error in ${this.model.name}.create:`, error);
        res.status(400).json({
          status: 'error',
          message: 'Failed to create record',
          error: error.message
        });
      }
    };
  
    /**
     * Update a record
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    update = async (req, res) => {
      try {
        const [updated] = await this.model.update(req.body, {
          where: { id: req.params.id }
        });
        
        if (updated === 0) {
          return res.status(404).json({
            status: 'error',
            message: `${this.model.name} not found or no changes made`
          });
        }
        
        const updatedItem = await this.model.findByPk(req.params.id);
        res.status(200).json({
          status: 'success',
          message: `${this.model.name} updated successfully`,
          data: updatedItem
        });
      } catch (error) {
        console.error(`Error in ${this.model.name}.update:`, error);
        res.status(400).json({
          status: 'error',
          message: 'Failed to update record',
          error: error.message
        });
      }
    };
  
    /**
     * Delete a record
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    delete = async (req, res) => {
      try {
        const deleted = await this.model.destroy({
          where: { id: req.params.id }
        });
        
        if (deleted === 0) {
          return res.status(404).json({
            status: 'error',
            message: `${this.model.name} not found`
          });
        }
        
        res.status(200).json({
          status: 'success',
          message: `${this.model.name} deleted successfully`
        });
      } catch (error) {
        console.error(`Error in ${this.model.name}.delete:`, error);
        res.status(500).json({
          status: 'error',
          message: 'Failed to delete record',
          error: error.message
        });
      }
    };
  }
  
  module.exports = BaseController;