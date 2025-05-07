const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InventoryBatch = sequelize.define('InventoryBatch', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inventory_items',
        key: 'id'
      }
    },
    batch_identifier: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Optional identifier like batch number or purchase date'
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    initial_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    current_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'inventory_batches',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return InventoryBatch;
};