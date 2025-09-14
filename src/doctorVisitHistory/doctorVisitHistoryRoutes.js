const express = require('express');
const router = express.Router();
const {
  getAllDoctorVisitHistories,
  getDoctorVisitHistoryById,
  createDoctorVisitHistory,
  updateDoctorVisitHistory,
  deleteDoctorVisitHistory
} = require('./doctorVisitHistoryController');

// GET all doctor visit histories
router.get('/', getAllDoctorVisitHistories);

// GET doctor visit history by ID
router.get('/:id', getDoctorVisitHistoryById);

// CREATE a new doctor visit history
router.post('/', createDoctorVisitHistory);

// UPDATE a doctor visit history
router.put('/:id', updateDoctorVisitHistory);

// DELETE a doctor visit history
router.delete('/:id', deleteDoctorVisitHistory);

module.exports = router;