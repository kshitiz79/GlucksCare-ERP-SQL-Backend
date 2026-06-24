// src/modules/auth/auth.routes.js

const express = require('express');
const AuthController = require('./auth.controller');
const validate = require('../../middleware/validation.middleware');
const { registerSchema, loginSchema } = require('./auth.validation');
const upload = require('../../middleware/upload');
const { authMiddleware } = require('../../middleware/authMiddleware');

const router = express.Router();

// REGISTER (uses multer parsing before validation since it's multipart/form-data)
router.post('/register', upload.any(), validate(registerSchema), AuthController.register);

// LOGIN
router.post('/login', validate(loginSchema), AuthController.login);

// GENERATE OTP (Email-based)
router.post('/generate-otp', AuthController.generateOtp);

// VERIFY OTP
router.post('/verify-otp', AuthController.verifyOtp);

// EMAIL LOGIN (Passwordless)
router.post('/email-login', AuthController.emailLogin);

// CHECK EMAIL REGISTERED
router.post('/check-email-registered', AuthController.checkEmailRegistered);

// SEND EMAIL OTP
router.post('/send-email-otp', AuthController.sendEmailOtp);

// VERIFY EMAIL OTP
router.post('/verify-email-otp', AuthController.verifyEmailOtp);

// GET CURRENT USER
router.get('/me', authMiddleware, AuthController.me);

module.exports = router;
