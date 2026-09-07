// src/doctor/doctorImageController.js

const cloudinary = require('../config/cloudinary');

// Upload a single image to Cloudinary
const uploadImage = async (file) => {
    try {
        // When using multer memory storage, file.buffer contains the file data
        // Wait for the upload to complete
        const result = await new Promise((resolve, reject) => {
            const upload_stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'doctor_geo_images',
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

// Handle doctor geo-image upload
const uploadDoctorGeoImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { Doctor } = req.app.get('models');

        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        // Find the doctor by Server ID or local clientGeneratedId
        let doctor = null;
        try {
            doctor = await Doctor.findByPk(id);
        } catch (e) {
            // In case id is not a valid UUID format
        }
        if (!doctor) {
            doctor = await Doctor.findOne({
                where: { clientGeneratedId: id }
            });
        }

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found (neither by server ID nor clientGeneratedId)'
            });
        }

        // Upload the image to Cloudinary
        const imageUrl = await uploadImage(req.file);

        // Update doctor with geo-image URL and increment sync version
        const nextVersion = (Number(doctor.syncVersion || doctor.sync_version) || 1) + 1;
        await doctor.update({
            geo_image_url: imageUrl,
            sync_version: nextVersion
        });

        // Record change log for sync
        const { DoctorChangeLog } = req.app.get('models');
        try {
            if (DoctorChangeLog) {
                await DoctorChangeLog.create({
                    doctorId: doctor.id,
                    operation: 'UPDATE',
                    headOfficeId: doctor.headOfficeId,
                    areaId: doctor.areaId || null,
                    snapshot: {
                        id: doctor.id,
                        name: doctor.name,
                        geo_image_url: imageUrl,
                        syncVersion: nextVersion
                    }
                });
            }
        } catch (logErr) {
            console.warn('⚠️ Warning: Failed to log geo-image update:', logErr.message);
        }

        // Fetch the updated doctor to return with all data
        const updatedDoctor = await Doctor.findByPk(doctor.id);

        res.status(200).json({
            success: true,
            message: 'Geo-image uploaded successfully',
            data: updatedDoctor
        });
    } catch (error) {
        console.error('Upload doctor geo-image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload geo-image'
        });
    }
};

module.exports = {
    uploadImage,
    uploadDoctorGeoImage
};
