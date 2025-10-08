// src/user/userRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUsersByRole,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  checkUserDependencies,
  getUserConstraints,
  softDeleteUser,
  deleteUserWithOptions,
  forceDeleteUser,
  getMyHeadOffices,
  registerAdmin,
  registerUser,
  getUsersByState,
  getMyState,
  updateUserStatus
} = require('./userController');

// Import simple MongoDB-style delete function
const { deleteUserSimple } = require('./simpleUserController');

const { authMiddleware } = require('../middleware/authMiddleware');

// REGISTER ADMIN (no auth required - for initial setup)
router.post('/register-admin', registerAdmin);

// REGISTER USER (no auth required - for creating regular users)
router.post('/register-user', registerUser);

// GET current user's assigned head offices (must be defined before :id route)
router.get('/my-head-offices', authMiddleware, getMyHeadOffices);

// GET current State Head user's assigned state
router.get('/my-state', authMiddleware, getMyState);

// GET users for shift assignment (no auth required for internal API calls)
router.get('/for-shift-assignment', getAllUsers);

// GET all users
router.get('/', authMiddleware, getAllUsers);

// GET users by state
router.get('/state/:stateId', authMiddleware, getUsersByState);

// GET users by role
router.get('/role/:role', authMiddleware, getUsersByRole);

// GET user by ID
router.get('/:id', authMiddleware, getUserById);

// CREATE a new user
router.post('/', authMiddleware, createUser);

// UPDATE a user
router.put('/:id', authMiddleware, updateUser);

// UPDATE user password
router.put('/:id/password', authMiddleware, updateUserPassword);

// UPDATE user status (activate/deactivate)
router.patch('/:id/status', authMiddleware, updateUserStatus);

// CHECK user dependencies before deletion
router.get('/:id/dependencies', authMiddleware, checkUserDependencies);

// GET foreign key constraints for users table
router.get('/constraints/info', authMiddleware, getUserConstraints);

// DELETE a user (MongoDB style - simple deletion without foreign key constraints)
router.delete('/:id', authMiddleware, deleteUserSimple);

// DELETE user with custom options
router.delete('/:id/with-options', authMiddleware, deleteUserWithOptions);

// SOFT DELETE a user (recommended - just deactivates)
router.put('/:id/deactivate', authMiddleware, softDeleteUser);

// FORCE DELETE a user (use with extreme caution)
router.delete('/:id/force', authMiddleware, forceDeleteUser);

module.exports = router;