const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('./departmentController');

// GET all departments
router.get('/', getAllDepartments);

// GET department by ID
router.get('/:id', getDepartmentById);

// CREATE a new department
router.post('/', createDepartment);

// UPDATE a department
router.put('/:id', updateDepartment);

// DELETE a department
router.delete('/:id', deleteDepartment);

module.exports = router;