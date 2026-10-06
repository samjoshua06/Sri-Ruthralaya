const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public/Direct PDF Receipt download
router.get('/receipt/:id', feeController.generateReceiptPDF);

// Student fee records & payments
router.get('/my-fees', authenticateToken, feeController.getMyFees);
router.post('/pay/:id', authenticateToken, feeController.payFee);
router.patch('/pay/:id', authenticateToken, feeController.payFee);
router.post('/:id/pay', authenticateToken, feeController.payFee);
router.patch('/:id/pay', authenticateToken, feeController.payFee);

// Admin fee management
router.get('/', authenticateToken, requireRole(['admin']), feeController.getAllFees);
router.post('/', authenticateToken, requireRole(['admin']), feeController.recordFee);
router.delete('/:id', authenticateToken, requireRole(['admin']), feeController.deleteFee);

module.exports = router;
