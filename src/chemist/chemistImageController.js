// src/chemist/chemistImageController.js

const cloudinary = require('../config/cloudinary');

// Upload a single image to Cloudinary
const uploadImage = async (file) => {
    try {
        // When using multer memory storage, file.buffer contains the file data
        // Wait for the upload to complete
        const result = await new Promise((resolve, reject) => {
            const upload_stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'chemist_geo_images',
                    resource_type: 'auto',
                    transformation: [
                        { width: 1200, height: 1200, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );
            upload_stream.end(file.buffer);
        });

        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image to Cloudinary');
    }
};

// Handle chemist geo-image upload
const uploadChemistGeoImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { Chemist } = req.app.get('models');

        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        // Find the chemist
        const chemist = await Chemist.findByPk(id);
        if (!chemist) {
            return res.status(404).json({
                success: false,
                message: 'Chemist not found'
            });
        }

        // Upload the image to Cloudinary
        const imageUrl = await uploadImage(req.file);

        // Update the chemist with the geo-image URL
        await chemist.update({ geo_image_url: imageUrl });

        // Fetch the updated chemist to return with all data
        const updatedChemist = await Chemist.findByPk(id);

        res.status(200).json({
            success: true,
            message: 'Geo-image uploaded successfully',
            data: updatedChemist
        });
    } catch (error) {
        console.error('Upload chemist geo-image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload geo-image'
        });
    }
};

module.exports = {
    uploadImage,
    uploadChemistGeoImage
};
