// routes/pdfs.js
const express = require('express');
const router = express.Router();
const {
  getAllPdfFiles,
  getPdfFileById,
  createPdfFile,
  updatePdfFile,
  deletePdfFile,
  uploadMiddleware,
  getPdfSignedUrl
} = require('./pdfController');

// Apply upload middleware to routes that need it
router.post('/', uploadMiddleware, createPdfFile);
router.put('/:id', updatePdfFile);
router.delete('/:id', deletePdfFile);
router.get('/', getAllPdfFiles);
router.get('/:id', getPdfFileById);
router.get('/:id/signed-url', getPdfSignedUrl);

module.exports = router;