const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceRecordDetail = sequelize.define('ServiceRecordDetail', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    service_record_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'service_records',
        key: 'id'
      }
    },
    description_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'service_description_items',
        key: 'id'
      }
    },
    custom_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'For additional details specific to this service'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'service_record_details',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return ServiceRecordDetail;
};