const express = require('express');
const router = express.Router();
const {
  getAllUserHeadOffices,
  getUserHeadOfficeById,
  createUserHeadOffice,
  deleteUserHeadOffice
} = require('./userHeadOfficeController');

// GET all user head offices
router.get('/', getAllUserHeadOffices);

// GET user head office by ID
router.get('/:id', getUserHeadOfficeById);

// CREATE a new user head office
router.post('/', createUserHeadOffice);

// DELETE a user head office
router.delete('/:id', deleteUserHeadOffice);

module.exports = router;