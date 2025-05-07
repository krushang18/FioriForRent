const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentNotification = sequelize.define('DocumentNotification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    machine_document_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'machine_documents',
        key: 'id'
      }
    },
    days_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Days before expiry to send notification'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: 'document_notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return DocumentNotification;
};