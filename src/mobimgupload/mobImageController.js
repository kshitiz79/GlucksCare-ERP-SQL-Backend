// src/mobimgupload/mobImageController.js

const cloudinary = require('../config/cloudinary');

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (file) => {
    try {
        const result = await new Promise((resolve, reject) => {
            const upload_stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'mob_images',
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


// 1. UPLOAD - Create new image with title
const uploadImage = async (req, res) => {
    try {
        const { title } = req.body;
        const { MobImage } = req.app.get('models');

        // Validate title
        if (!title || title.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(req.file);

        // Save to database
        const mobImage = await MobImage.create({
            title: title.trim(),
            image_url: imageUrl
        });

        res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            data: mobImage
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image'
        });
    }
};

// 2. GET - Get all images or single image by ID
const getImages = async (req, res) => {
    try {
        const { id } = req.params;
        const { MobImage } = req.app.get('models');

        // If ID is provided, get single image
        if (id) {
            const mobImage = await MobImage.findByPk(id);

            if (!mobImage) {
                return res.status(404).json({
                    success: false,
                    message: 'Image not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: mobImage
            });
        }

        // Get all images
        const mobImages = await MobImage.findAll({
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            success: true,
            count: mobImages.length,
            data: mobImages
        });
    } catch (error) {
        console.error('Get images error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch images'
        });
    }
};

// 3. DELETE - Delete image
const deleteImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { MobImage } = req.app.get('models');

        // Find the image
        const mobImage = await MobImage.findByPk(id);

        if (!mobImage) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Delete from database
        await mobImage.destroy();

        res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete image'
        });
    }
};

// 4. UPDATE - Edit image title (and optionally replace image)
const updateImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        const { MobImage } = req.app.get('models');

        // Find the image
        const mobImage = await MobImage.findByPk(id);

        if (!mobImage) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        const updateData = {};

        // Update title if provided
        if (title && title.trim() !== '') {
            updateData.title = title.trim();
        }

        // If new image file is uploaded, replace the old one
        if (req.file) {
            // Upload new image
            const imageUrl = await uploadToCloudinary(req.file);
            updateData.image_url = imageUrl;
        }

        // Update the record
        await mobImage.update(updateData);

        // Fetch updated record
        const updatedImage = await MobImage.findByPk(id);

        res.status(200).json({
            success: true,
            message: 'Image updated successfully',
            data: updatedImage
        });
    } catch (error) {
        console.error('Update image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update image'
        });
    }
};

module.exports = {
    uploadImage,
    getImages,
    deleteImage,
    updateImage
};
