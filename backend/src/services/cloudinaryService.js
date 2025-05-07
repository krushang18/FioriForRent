const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload a file to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} folder - The folder to upload to in Cloudinary
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadFile = (fileBuffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    // Create a readable stream from the buffer
    const stream = Readable.from(fileBuffer);
    
    // Create an upload stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        ...options
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Pipe the readable stream to the upload stream
    stream.pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file to delete
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
const deleteFile = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    throw new Error(`Error deleting file from Cloudinary: ${error.message}`);
  }
};

/**
 * Get a signed URL for a file
 * @param {string} publicId - The public ID of the file
 * @param {Object} options - Options for the signed URL
 * @returns {string} - The signed URL
 */
const getSignedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    secure: true,
    resource_type: 'image',
    ...options
  };
  
  return cloudinary.url(publicId, defaultOptions);
};

module.exports = {
  uploadFile,
  deleteFile,
  getSignedUrl
};