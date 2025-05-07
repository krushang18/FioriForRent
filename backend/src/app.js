const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { handleUploadError } = require('./middleware/uploadMiddleware');
const routes = require('./routes');

// Initialize Express app
const app = express();

// Enable if behind a proxy (like Nginx or Heroku)
app.set('trust proxy', 1);

// Apply security headers
app.use(helmet());

// Rate limiting
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again after 15 minutes'
// });

// // Apply rate limiting to all routes
// app.use(apiLimiter);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parse cookies
app.use(cookieParser());

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Request logging in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files from public directory
app.use(express.static('public'));

// Mount API routes
app.use('/api', routes);

// File upload error handler
app.use(handleUploadError);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

module.exports = app;