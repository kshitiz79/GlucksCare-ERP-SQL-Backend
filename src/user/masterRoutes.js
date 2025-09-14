// src/user/masterRoutes.js

const express = require('express');
const { State, HeadOffice, Branch, Department, Designation, EmploymentType } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// GET all branches
router.get('/branches', authMiddleware, async (req, res) => {
    try {
        const branches = await Branch.findAll({
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: branches
        });
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// CREATE a new branch
router.post('/branches', authMiddleware, async (req, res) => {
    try {
        // Only allow specific fields to be set
        const allowedFields = ['name', 'code', 'address', 'contact_number', 'email'];
        const branchData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                branchData[field] = req.body[field];
            }
        });
        
        const branch = await Branch.create(branchData);
        res.status(201).json({
            success: true,
            data: branch
        });
    } catch (error) {
        console.error('Create branch error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to create branch',
            error: error.message
        });
    }
});

// UPDATE a branch
router.put('/branches/:id', authMiddleware, async (req, res) => {
    try {
        const branch = await Branch.findByPk(req.params.id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                msg: 'Branch not found'
            });
        }
        
        // Only allow specific fields to be updated
        const allowedFields = ['name', 'code', 'address', 'contact_number', 'email'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        await branch.update(updateData);
        res.json({
            success: true,
            data: branch
        });
    } catch (error) {
        console.error('Update branch error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to update branch',
            error: error.message
        });
    }
});

// DELETE a branch
router.delete('/branches/:id', authMiddleware, async (req, res) => {
    try {
        const branch = await Branch.findByPk(req.params.id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                msg: 'Branch not found'
            });
        }
        
        await branch.destroy();
        res.json({
            success: true,
            msg: 'Branch deleted successfully'
        });
    } catch (error) {
        console.error('Delete branch error:', error);
        res.status(500).json({
            success: false,
            msg: 'Failed to delete branch',
            error: error.message
        });
    }
});

// GET all departments
router.get('/departments', authMiddleware, async (req, res) => {
    try {
        const departments = await Department.findAll({
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: departments
        });
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// CREATE a new department
router.post('/departments', authMiddleware, async (req, res) => {
    try {
        // Only allow specific fields to be set
        const allowedFields = ['name', 'code', 'description'];
        const departmentData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                departmentData[field] = req.body[field];
            }
        });
        
        const department = await Department.create(departmentData);
        res.status(201).json({
            success: true,
            data: department
        });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to create department',
            error: error.message
        });
    }
});

// UPDATE a department
router.put('/departments/:id', authMiddleware, async (req, res) => {
    try {
        const department = await Department.findByPk(req.params.id);
        if (!department) {
            return res.status(404).json({
                success: false,
                msg: 'Department not found'
            });
        }
        
        // Only allow specific fields to be updated
        const allowedFields = ['name', 'code', 'description'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        await department.update(updateData);
        res.json({
            success: true,
            data: department
        });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to update department',
            error: error.message
        });
    }
});

// DELETE a department
router.delete('/departments/:id', authMiddleware, async (req, res) => {
    try {
        const department = await Department.findByPk(req.params.id);
        if (!department) {
            return res.status(404).json({
                success: false,
                msg: 'Department not found'
            });
        }
        
        await department.destroy();
        res.json({
            success: true,
            msg: 'Department deleted successfully'
        });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({
            success: false,
            msg: 'Failed to delete department',
            error: error.message
        });
    }
});

// GET all designations
router.get('/designations', authMiddleware, async (req, res) => {
    try {
        const designations = await Designation.findAll({
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: designations
        });
    } catch (error) {
        console.error('Get designations error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// CREATE a new designation
router.post('/designations', authMiddleware, async (req, res) => {
    try {
        // Only allow specific fields to be set
        const allowedFields = ['name', 'description'];
        const designationData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                designationData[field] = req.body[field];
            }
        });
        
        const designation = await Designation.create(designationData);
        res.status(201).json({
            success: true,
            data: designation
        });
    } catch (error) {
        console.error('Create designation error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to create designation',
            error: error.message
        });
    }
});

// UPDATE a designation
router.put('/designations/:id', authMiddleware, async (req, res) => {
    try {
        const designation = await Designation.findByPk(req.params.id);
        if (!designation) {
            return res.status(404).json({
                success: false,
                msg: 'Designation not found'
            });
        }
        
        // Only allow specific fields to be updated
        const allowedFields = ['name', 'description'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        await designation.update(updateData);
        res.json({
            success: true,
            data: designation
        });
    } catch (error) {
        console.error('Update designation error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to update designation',
            error: error.message
        });
    }
});

// DELETE a designation
router.delete('/designations/:id', authMiddleware, async (req, res) => {
    try {
        const designation = await Designation.findByPk(req.params.id);
        if (!designation) {
            return res.status(404).json({
                success: false,
                msg: 'Designation not found'
            });
        }
        
        await designation.destroy();
        res.json({
            success: true,
            msg: 'Designation deleted successfully'
        });
    } catch (error) {
        console.error('Delete designation error:', error);
        res.status(500).json({
            success: false,
            msg: 'Failed to delete designation',
            error: error.message
        });
    }
});

// GET all employment types
router.get('/employment-types', authMiddleware, async (req, res) => {
    try {
        const employmentTypes = await EmploymentType.findAll({
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: employmentTypes
        });
    } catch (error) {
        console.error('Get employment types error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// CREATE a new employment type
router.post('/employment-types', authMiddleware, async (req, res) => {
    try {
        // Only allow specific fields to be set
        const allowedFields = ['name', 'code', 'description'];
        const employmentTypeData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                employmentTypeData[field] = req.body[field];
            }
        });
        
        const employmentType = await EmploymentType.create(employmentTypeData);
        res.status(201).json({
            success: true,
            data: employmentType
        });
    } catch (error) {
        console.error('Create employment type error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to create employment type',
            error: error.message
        });
    }
});

// UPDATE an employment type
router.put('/employment-types/:id', authMiddleware, async (req, res) => {
    try {
        const employmentType = await EmploymentType.findByPk(req.params.id);
        if (!employmentType) {
            return res.status(404).json({
                success: false,
                msg: 'Employment type not found'
            });
        }
        
        // Only allow specific fields to be updated
        const allowedFields = ['name', 'code', 'description'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        await employmentType.update(updateData);
        res.json({
            success: true,
            data: employmentType
        });
    } catch (error) {
        console.error('Update employment type error:', error);
        res.status(400).json({
            success: false,
            msg: 'Failed to update employment type',
            error: error.message
        });
    }
});

// DELETE an employment type
router.delete('/employment-types/:id', authMiddleware, async (req, res) => {
    try {
        const employmentType = await EmploymentType.findByPk(req.params.id);
        if (!employmentType) {
            return res.status(404).json({
                success: false,
                msg: 'Employment type not found'
            });
        }
        
        await employmentType.destroy();
        res.json({
            success: true,
            msg: 'Employment type deleted successfully'
        });
    } catch (error) {
        console.error('Delete employment type error:', error);
        res.status(500).json({
            success: false,
            msg: 'Failed to delete employment type',
            error: error.message
        });
    }
});

// GET all states
router.get('/states', authMiddleware, async (req, res) => {
    try {
        const states = await State.findAll({
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: states
        });
    } catch (error) {
        console.error('Get states error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// GET all head offices
router.get('/head-offices', authMiddleware, async (req, res) => {
    try {
        const { stateId } = req.query;
        const whereClause = {};
        
        if (stateId) {
            whereClause.stateId = stateId;
        }

        const headOffices = await HeadOffice.findAll({
            where: whereClause,
            include: [
                {
                    model: State,
                    as: 'state',
                    attributes: ['id', 'name', 'code']
                }
            ],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            data: headOffices
        });
    } catch (error) {
        console.error('Get head offices error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

// GET roles
router.get('/roles', authMiddleware, async (req, res) => {
    try {
        const roles = [
            'Super Admin',
            'Admin',
            'Opps Team',
            'National Head',
            'State Head',
            'Zonal Manager',
            'Area Manager',
            'Manager',
            'User'
        ];

        res.json({
            success: true,
            data: roles
        });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;