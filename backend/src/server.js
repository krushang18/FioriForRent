require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const { scheduleDocumentExpiryCheck } = require('./schedulers/documentExpiryScheduler');
const emailProcessor = require('./services/emailProcessor');

const PORT = process.env.PORT || 5000;

// Test database connection
const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    // Sync models with database (only in development)
    if (process.env.NODE_ENV === 'development' && process.env.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced successfully.');
    }
    
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

// Start the server
const startServer = async () => {
  // Test database connection first
  const isDbConnected = await connectToDatabase();
  
  if (!isDbConnected) {
    logger.error('Exiting due to database connection failure');
    process.exit(1);
  }
  
  // Start Express server
  app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`API accessible at http://localhost:${PORT}/api`);
    
    // Start scheduled tasks
    scheduleDocumentExpiryCheck();
    emailProcessor.startProcessing();
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err);
  
  // Gracefully shutdown
  process.exit(1);
});

// Handle SIGTERM signal
// process.on('SIGTERM', () => {
//   logger.info('SIGTERM received. Shutting down gracefully...');
//   process.exit(0);
// });
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  emailProcessor.stopProcessing();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  emailProcessor.stopProcessing();
  process.exit(0);
});

// Start the server
startServer();