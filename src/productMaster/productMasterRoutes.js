const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const defaultDb = require('../config/database');

// Helper to reliably retrieve tenant-scoped models or fallback
const getModels = (req) => req.db || (req.app && req.app.get('models')) || defaultDb;

// Unified Master Controller Logic

// GET all items for a specific master type
router.get('/:type', authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        const models = getModels(req);
        
        const typeToModelName = {
            'salts': 'Salt',
            'units': 'Unit',
            'stripsizes': 'StripSize',
            'hsns': 'Hsn',
            'gsts': 'Gst',
            'packsizes': 'PackSize'
        };

        const modelName = typeToModelName[type];
        const Model = models[modelName];
        
        if (!Model) {
            return res.status(400).json({ success: false, message: 'Invalid master type' });
        }
        
        const items = await Model.findAll({
            order: [['name', 'ASC']]
        });
        
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CREATE a new item for a specific master type
router.post('/:type', authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        const { name } = req.body;
        const models = getModels(req);
        
        const typeToModelName = {
            'salts': 'Salt',
            'units': 'Unit',
            'stripsizes': 'StripSize',
            'hsns': 'Hsn',
            'gsts': 'Gst',
            'packsizes': 'PackSize'
        };

        const modelName = typeToModelName[type];
        const Model = models[modelName];
        
        if (!Model) {
            return res.status(400).json({ success: false, message: 'Invalid master type' });
        }
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        
        const item = await Model.create({ name });
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ success: false, message: 'This item already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE an item
router.delete('/:type/:id', authMiddleware, async (req, res) => {
    try {
        const { type, id } = req.params;
        const models = getModels(req);
        
        const typeToModelName = {
            'salts': 'Salt',
            'units': 'Unit',
            'stripsizes': 'StripSize',
            'hsns': 'Hsn',
            'gsts': 'Gst',
            'packsizes': 'PackSize'
        };

        const modelName = typeToModelName[type];
        const Model = models[modelName];
        
        if (!Model) {
            return res.status(400).json({ success: false, message: 'Invalid master type' });
        }
        
        const item = await Model.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        await item.destroy();
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPDATE an item
router.put('/:type/:id', authMiddleware, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { name } = req.body;
        const models = getModels(req);
        
        const typeToModelName = {
            'salts': 'Salt',
            'units': 'Unit',
            'stripsizes': 'StripSize',
            'hsns': 'Hsn',
            'gsts': 'Gst',
            'packsizes': 'PackSize'
        };

        const modelName = typeToModelName[type];
        const Model = models[modelName];
        
        if (!Model) {
            return res.status(400).json({ success: false, message: 'Invalid master type' });
        }

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        
        const item = await Model.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        await item.update({ name });
        res.json({ success: true, data: item });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ success: false, message: 'This item already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
