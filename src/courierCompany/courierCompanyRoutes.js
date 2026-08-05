// src/courierCompany/courierCompanyRoutes.js
const express = require('express');
const router = express.Router();
const courierCompanyController = require('./courierCompanyController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/unmapped-names', courierCompanyController.getUnmappedNames);
router.post('/bulk-replace', courierCompanyController.bulkReplaceNames);

router.get('/', courierCompanyController.getCompanies);
router.get('/:id', courierCompanyController.getCompanyById);
router.post('/', courierCompanyController.createCompany);
router.put('/:id', courierCompanyController.updateCompany);
router.delete('/:id', courierCompanyController.deleteCompany);

module.exports = router;
