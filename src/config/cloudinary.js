// src/config/cloudinary.js

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dddxaeyga',
    api_key: process.env.CLOUDINARY_API_KEY || '927335258247917',
    api_secret: process.env.CLOUDINARY_API_SECRET || '7JnQUXP9mk8XFUxBgVVIg8JSA2k'
});

module.exports = cloudinary;