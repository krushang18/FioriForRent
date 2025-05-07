const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceRecord = sequelize.define('ServiceRecord', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    machine_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'machines',
        key: 'id'
      }
    },
    service_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    engine_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    site_location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    operator: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who created the record'
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
    tableName: 'service_records',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return ServiceRecord;
};