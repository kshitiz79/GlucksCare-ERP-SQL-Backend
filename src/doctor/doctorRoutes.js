const express = require('express');
const router = express.Router();
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHeadOffice,
  getMyDoctors
} = require('./doctorController');

const { authMiddleware } = require('../middleware/authMiddleware');

// GET all doctors
router.get('/', authMiddleware, getAllDoctors);

// GET doctors by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getDoctorsByHeadOffice);

// GET doctors for current user's head offices
router.get('/my-doctors', authMiddleware, getMyDoctors);

// GET doctor by ID
router.get('/:id', authMiddleware, getDoctorById);

// CREATE a new doctor
router.post('/', authMiddleware, createDoctor);

// UPDATE a doctor
router.put('/:id', authMiddleware, updateDoctor);

// DELETE a doctor
router.delete('/:id', authMiddleware, deleteDoctor);

module.exports = router;