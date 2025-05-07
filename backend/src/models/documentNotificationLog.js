const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentNotificationLog = sequelize.define('DocumentNotificationLog', {
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
      comment: 'Days before expiry when notification was sent'
    },
    notification_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'document_notification_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['machine_document_id', 'days_before', 'notification_date']
      }
    ]
  });

  return DocumentNotificationLog;
};