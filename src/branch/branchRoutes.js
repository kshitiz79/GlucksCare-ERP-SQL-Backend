const express = require('express');
const router = express.Router();
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
} = require('./branchController');

// GET all branches
router.get('/', getAllBranches);

// GET branch by ID
router.get('/:id', getBranchById);

// CREATE a new branch
router.post('/', createBranch);

// UPDATE a branch
router.put('/:id', updateBranch);

// DELETE a branch
router.delete('/:id', deleteBranch);

module.exports = router;