const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// Razorpay Standard Checkout
router.post('/create-order', authenticateToken, paymentController.createOrder);
router.post('/verify-payment', authenticateToken, paymentController.verifyPayment);

module.exports = router;
