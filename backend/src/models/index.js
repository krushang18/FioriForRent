const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password, {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging
  }
);

// Import existing models
const UserModel = require('./User');
const CustomerQueryModel = require('./CustomerQuery');
const MachineModel = require('./Machine');
const TermsConditionsModel = require('./TermsConditions');
const CompanyDetailsModel = require('./CompanyDetails');
const CustomerModel = require('./Customer');
const QuotationTemplateModel = require('./QuotationTemplate');

// Import new models
const MachineDocumentModel = require('./MachineDocument');
const DocumentNotificationModel = require('./DocumentNotification');
const ServiceRecordModel = require('./ServiceRecord');
const ServiceDescriptionItemModel = require('./ServiceDescriptionItem');
const ServiceRecordDetailModel = require('./ServiceRecordDetail');
const InventoryItemModel = require('./InventoryItem');
const InventoryBatchModel = require('./InventoryBatch');
const InventoryTransactionModel = require('./InventoryTransaction');
const DocumentNotificationLogModel = require('./DocumentNotificationLog');

// Initialize existing models
const User = UserModel(sequelize);
const CustomerQuery = CustomerQueryModel(sequelize);
const Machine = MachineModel(sequelize);
const TermsConditions = TermsConditionsModel(sequelize);
const CompanyDetails = CompanyDetailsModel(sequelize);
const Customer = CustomerModel(sequelize);
const QuotationTemplate = QuotationTemplateModel(sequelize);
const DocumentNotificationLog = DocumentNotificationLogModel(sequelize);

// Initialize new models
const MachineDocument = MachineDocumentModel(sequelize);
const DocumentNotification = DocumentNotificationModel(sequelize);
const ServiceRecord = ServiceRecordModel(sequelize);
const ServiceDescriptionItem = ServiceDescriptionItemModel(sequelize);
const ServiceRecordDetail = ServiceRecordDetailModel(sequelize);
const InventoryItem = InventoryItemModel(sequelize);
const InventoryBatch = InventoryBatchModel(sequelize);
const InventoryTransaction = InventoryTransactionModel(sequelize);

// Define new associations
// Machine to MachineDocument: One-to-Many
Machine.hasMany(MachineDocument, {
  foreignKey: 'machine_id',
  as: 'documents',
  onDelete: 'CASCADE'
});
MachineDocument.belongsTo(Machine, {
  foreignKey: 'machine_id',
  as: 'machine'
});

// MachineDocument to DocumentNotification: One-to-Many
MachineDocument.hasMany(DocumentNotification, {
  foreignKey: 'machine_document_id',
  as: 'notifications',
  onDelete: 'CASCADE'
});
DocumentNotification.belongsTo(MachineDocument, {
  foreignKey: 'machine_document_id',
  as: 'document'
});

// Machine to ServiceRecord: One-to-Many
Machine.hasMany(ServiceRecord, {
  foreignKey: 'machine_id',
  as: 'serviceRecords',
  onDelete: 'CASCADE'
});
ServiceRecord.belongsTo(Machine, {
  foreignKey: 'machine_id',
  as: 'machine'
});

// User to ServiceRecord: One-to-Many
User.hasMany(ServiceRecord, {
  foreignKey: 'created_by',
  as: 'serviceRecords'
});
ServiceRecord.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

// ServiceRecord to ServiceRecordDetail: One-to-Many
ServiceRecord.hasMany(ServiceRecordDetail, {
  foreignKey: 'service_record_id',
  as: 'details',
  onDelete: 'CASCADE'
});
ServiceRecordDetail.belongsTo(ServiceRecord, {
  foreignKey: 'service_record_id',
  as: 'serviceRecord'
});

// ServiceDescriptionItem to ServiceRecordDetail: One-to-Many
ServiceDescriptionItem.hasMany(ServiceRecordDetail, {
  foreignKey: 'description_item_id',
  as: 'recordDetails'
});
ServiceRecordDetail.belongsTo(ServiceDescriptionItem, {
  foreignKey: 'description_item_id',
  as: 'descriptionItem'
});

// InventoryItem to InventoryBatch: One-to-Many
InventoryItem.hasMany(InventoryBatch, {
  foreignKey: 'item_id',
  as: 'batches',
  onDelete: 'CASCADE'
});
InventoryBatch.belongsTo(InventoryItem, {
  foreignKey: 'item_id',
  as: 'item'
});

// InventoryBatch to InventoryTransaction: One-to-Many
InventoryBatch.hasMany(InventoryTransaction, {
  foreignKey: 'batch_id',
  as: 'transactions',
  onDelete: 'CASCADE'
});
InventoryTransaction.belongsTo(InventoryBatch, {
  foreignKey: 'batch_id',
  as: 'batch'
});

// User to InventoryTransaction: One-to-Many
User.hasMany(InventoryTransaction, {
  foreignKey: 'performed_by',
  as: 'inventoryTransactions'
});
InventoryTransaction.belongsTo(User, {
  foreignKey: 'performed_by',
  as: 'performer'
});

DocumentNotificationLog.belongsTo(MachineDocument, {
  foreignKey: 'machine_document_id',
  as: 'document'
});

MachineDocument.hasMany(DocumentNotificationLog, {
  foreignKey: 'machine_document_id',
  as: 'logs'
});


// Export models and sequelize connection
module.exports = {
  sequelize,
  User,
  CustomerQuery,
  Machine,
  TermsConditions,
  CompanyDetails,
  Customer,
  // Quotation,
  // QuotationItem,
  // QuotationTerms,
  QuotationTemplate,
  // Export new models
  DocumentNotificationLog,
  MachineDocument,
  DocumentNotification,
  ServiceRecord,
  ServiceDescriptionItem,
  ServiceRecordDetail,
  InventoryItem,
  InventoryBatch,
  InventoryTransaction
};