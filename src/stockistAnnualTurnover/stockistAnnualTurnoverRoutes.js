const express = require('express');
const router = express.Router();
const {
  getAllStockistAnnualTurnovers,
  getStockistAnnualTurnoverById,
  createStockistAnnualTurnover,
  updateStockistAnnualTurnover,
  deleteStockistAnnualTurnover
} = require('./stockistAnnualTurnoverController');

// GET all stockist annual turnovers
router.get('/', getAllStockistAnnualTurnovers);

// GET stockist annual turnover by ID
router.get('/:id', getStockistAnnualTurnoverById);

// CREATE a new stockist annual turnover
router.post('/', createStockistAnnualTurnover);

// UPDATE a stockist annual turnover
router.put('/:id', updateStockistAnnualTurnover);

// DELETE a stockist annual turnover
router.delete('/:id', deleteStockistAnnualTurnover);

module.exports = router;