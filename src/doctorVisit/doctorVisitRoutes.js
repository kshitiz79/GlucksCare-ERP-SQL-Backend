const express = require('express');
const router = express.Router();
const {
  getAllDoctorVisits,
  getDoctorVisitById,
  createDoctorVisit,
  updateDoctorVisit,
  deleteDoctorVisit,
  confirmDoctorVisit,
  getDoctorVisitsByUserId
} = require('./doctorVisitController');

// GET all doctor visits
router.get('/', getAllDoctorVisits);

// GET visits by user ID (MUST come before /:id to avoid route conflict)
router.get('/user/:userId', getDoctorVisitsByUserId);

// GET doctor visit by ID
router.get('/:id', getDoctorVisitById);

// CREATE a new doctor visit
router.post('/', createDoctorVisit);

// UPDATE a doctor visit
router.put('/:id', updateDoctorVisit);

// DELETE a doctor visit
router.delete('/:id', deleteDoctorVisit);

// CONFIRM a doctor visit
router.put('/:id/confirm', confirmDoctorVisit);

module.exports = router;