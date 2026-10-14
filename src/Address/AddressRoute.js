const express = require('express');
const router = express.Router();
const addressController = require('./AddressControllers');

// Memory leak testing routes (placed before /:id)
router.all('/test-memory-leak', addressController.testMemoryLeak);
router.post('/clear-memory-leak', addressController.clearMemoryLeak);

router.post('/', addressController.createAddress);
router.get('/', addressController.getAllAddresses);
router.get('/:id', addressController.getAddressById);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.put('/:id/set-default-origin', addressController.setDefaultOriginAddress);

module.exports = router;
