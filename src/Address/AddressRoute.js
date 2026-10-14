const express = require('express');
const router = express.Router();
const addressController = require('./AddressControllers');

// System load & metrics testing routes (placed before /:id)
router.get('/system-metrics', addressController.getSystemMetrics);
router.all('/stress-test', addressController.runStressTest);
router.post('/stress-test/release', addressController.releaseStressMemory);

router.post('/', addressController.createAddress);
router.get('/', addressController.getAllAddresses);
router.get('/:id', addressController.getAddressById);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.put('/:id/set-default-origin', addressController.setDefaultOriginAddress);

module.exports = router;

