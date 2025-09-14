const express = require('express');
const router = express.Router();
const {
  getAllChemistAnnualTurnovers,
  getChemistAnnualTurnoverById,
  createChemistAnnualTurnover,
  updateChemistAnnualTurnover,
  deleteChemistAnnualTurnover
} = require('./chemistAnnualTurnoverController');

// GET all chemist annual turnovers
router.get('/', getAllChemistAnnualTurnovers);

// GET chemist annual turnover by ID
router.get('/:id', getChemistAnnualTurnoverById);

// CREATE a new chemist annual turnover
router.post('/', createChemistAnnualTurnover);

// UPDATE a chemist annual turnover
router.put('/:id', updateChemistAnnualTurnover);

// DELETE a chemist annual turnover
router.delete('/:id', deleteChemistAnnualTurnover);

module.exports = router;