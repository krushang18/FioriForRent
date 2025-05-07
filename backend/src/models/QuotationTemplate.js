const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuotationTemplate = sequelize.define('QuotationTemplate', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Default Template'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    header_content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML content for the header section of the template'
    },
    footer_content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML content for the footer section of the template'
    },
    body_content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML content for the main body section of the template'
    },
    item_table_format: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML/CSS for formatting the items table'
    },
    terms_format: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML/CSS for formatting the terms and conditions section'
    },
    css_styles: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'CSS styles for the template'
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
    tableName: 'quotation_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return QuotationTemplate;
};