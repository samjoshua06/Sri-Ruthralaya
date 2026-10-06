const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Admin/Staff routes
router.get('/', authenticateToken, requireRole(['admin', 'staff']), studentController.getAllStudents);
router.post('/', authenticateToken, requireRole(['admin']), studentController.createStudent);
router.put('/:id/approve', authenticateToken, requireRole(['admin']), studentController.approveStudent);
router.patch('/:id/approve', authenticateToken, requireRole(['admin']), studentController.approveStudent);
router.patch('/:id/status', authenticateToken, requireRole(['admin']), studentController.toggleStudentStatus);
router.delete('/:id', authenticateToken, requireRole(['admin']), studentController.deleteStudent);

// Student or Admin route
router.get('/:id', authenticateToken, studentController.getStudentById);
router.put('/:id', authenticateToken, studentController.updateStudent);
router.patch('/:id', authenticateToken, studentController.updateStudent);

module.exports = router;
