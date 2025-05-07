const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InventoryTransaction = sequelize.define('InventoryTransaction', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inventory_batches',
        key: 'id'
      }
    },
    transaction_type: {
      type: DataTypes.ENUM('IN', 'OUT', 'RETURN'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    reference_note: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Purpose/Machine/Site etc.'
    },
    transaction_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who performed the transaction'
    }
  }, {
    tableName: 'inventory_transactions',
    timestamps: false
  });

  return InventoryTransaction;
};