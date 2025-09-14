// src/user/userRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getMyHeadOffices
} = require('./userController');

const { authMiddleware } = require('../middleware/authMiddleware');

// GET current user's assigned head offices (must be defined before :id route)
router.get('/my-head-offices', authMiddleware, getMyHeadOffices);

// GET all users
router.get('/', authMiddleware, getAllUsers);

// GET user by ID
router.get('/:id', authMiddleware, getUserById);

// CREATE a new user
router.post('/', authMiddleware, createUser);

// UPDATE a user
router.put('/:id', authMiddleware, updateUser);

// DELETE a user
router.delete('/:id', authMiddleware, deleteUser);

module.exports = router;