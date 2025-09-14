const express = require('express');
const router = express.Router();
const {
  getAllUserManagers,
  getUserManagerById,
  createUserManager,
  deleteUserManager
} = require('./userManagerController');

// GET all user managers
router.get('/', getAllUserManagers);

// GET user manager by ID
router.get('/:id', getUserManagerById);

// CREATE a new user manager
router.post('/', createUserManager);

// DELETE a user manager
router.delete('/:id', deleteUserManager);

module.exports = router;