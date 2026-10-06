const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const batchRoutes = require('./batchRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const feeRoutes = require('./feeRoutes');
const eventRoutes = require('./eventRoutes');
const noticeRoutes = require('./noticeRoutes');
const galleryRoutes = require('./galleryRoutes');
const chatbotRoutes = require('./chatbotRoutes');
const adminRoutes = require('./adminRoutes');
const paymentRoutes = require('./paymentRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/batches', batchRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/fees', feeRoutes);
router.use('/events', eventRoutes);
router.use('/notices', noticeRoutes);
router.use('/gallery', galleryRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/admin', adminRoutes);
router.use('/', paymentRoutes); // POST /create-order, POST /verify-payment

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'Sri Ruthralaya API',
      status: 'healthy',
      time: new Date(),
    },
    message: 'Backend API is running smoothly.',
  });
});

module.exports = router;
