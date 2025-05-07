const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MachineDocument = sequelize.define('MachineDocument', {
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
    document_type: {
      type: DataTypes.ENUM('RC_Book', 'PUC', 'Fitness', 'Insurance'),
      allowNull: false
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    last_renewed_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'machine_documents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['machine_id', 'document_type']
      }
    ]
  });

  return MachineDocument;
};