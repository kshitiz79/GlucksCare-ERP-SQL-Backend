// src/services/cloudinary.service.js

const cloudinary = require('../config/cloudinary');

class CloudinaryService {
    static async uploadBuffer(buffer, options = {}) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
            uploadStream.end(buffer);
        });
    }
}

module.exports = CloudinaryService;
