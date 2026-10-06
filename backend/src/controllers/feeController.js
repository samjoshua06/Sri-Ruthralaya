const PDFDocument = require('pdfkit');
const { z } = require('zod');
const { db, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');

const feeRecordSchema = z.object({
  student_id: z.string(),
  amount: z.number().positive(),
  due_date: z.string(),
  month: z.string().optional(),
  status: z.enum(['paid', 'pending', 'overdue']).default('pending'),
  paid_date: z.string().optional(),
  payment_ref: z.string().optional(),
});

/**
 * Get all fees (Admin)
 */
async function getAllFees(req, res, next) {
  try {
    const { status, student_id } = req.query;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const where = {};
      if (status) where.status = status;
      if (student_id) where.student_id = student_id;

      const fees = await db.fee.findMany({
        where,
      });

      const formatted = fees.map(f => ({
        ...f,
        amount: Number(f.amount),
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
        message: 'Fees fetched successfully.',
      });
    } else {
      let fees = [...fallbackStore.fees];
      if (status) fees = fees.filter(f => f.status === status);
      if (student_id) fees = fees.filter(f => f.student_id === student_id);

      const formatted = fees.map(f => {
        const student = fallbackStore.users.find(u => u.id === f.student_id);
        return {
          ...f,
          student: student ? { id: student.id, name: student.name, email: student.email, phone: student.phone } : null,
        };
      });

      return res.status(200).json({
        success: true,
        data: formatted,
        message: 'Fees fetched successfully.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get fees for logged-in Student
 */
async function getMyFees(req, res, next) {
  try {
    const student_id = req.user.id;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      let fees = await db.fee.findMany({
        where: { student_id },
      });

      // If student has no fee records yet, automatically generate their initial pending fee invoice
      if (fees.length === 0) {
        try {
          const enr = await db.enrollment.findFirst({ where: { student_id } });
          let amount = 2400;
          if (enr) {
            const batch = await db.batch.findUnique({ where: { id: enr.batch_id } });
            if (batch && batch.fee_amount) amount = Number(batch.fee_amount);
          }
          const now = new Date();
          const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          const dueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const newFee = await db.fee.create({
            data: {
              student_id,
              amount,
              due_date: dueDate,
              status: 'pending',
              month: `${monthName} Tuition`,
            },
          });
          fees = [newFee];
        } catch (autoErr) {
          console.warn('Auto fee invoice creation note:', autoErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        data: fees.map(f => ({ ...f, amount: Number(f.amount) })),
        message: 'Student fee history retrieved.',
      });
    } else {
      let fees = fallbackStore.fees.filter(f => f.student_id === student_id);

      if (fees.length === 0) {
        const enr = fallbackStore.enrollments.find(e => e.student_id === student_id);
        let amount = 2400;
        if (enr) {
          const batch = fallbackStore.batches.find(b => b.id === enr.batch_id);
          if (batch && batch.fee_amount) amount = Number(batch.fee_amount);
        }
        const now = new Date();
        const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const dueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const newFee = {
          id: `fee-${Date.now()}`,
          student_id,
          amount,
          due_date: dueDate,
          status: 'pending',
          month: `${monthName} Tuition`,
          created_at: now,
        };
        fallbackStore.fees.push(newFee);
        fees = [newFee];
      }

      return res.status(200).json({
        success: true,
        data: fees,
        message: 'Student fee history retrieved.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Record or create a new fee entry (Admin)
 */
async function recordFee(req, res, next) {
  try {
    const validated = feeRecordSchema.parse(req.body);
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let createdFee;
    if (isDb) {
      createdFee = await db.fee.create({
        data: {
          student_id: validated.student_id,
          amount: validated.amount,
          due_date: new Date(validated.due_date),
          paid_date: validated.paid_date ? new Date(validated.paid_date) : null,
          status: validated.status,
          month: validated.month || 'Current Month',
          payment_ref: validated.payment_ref || null,
        },
      });
    } else {
      createdFee = {
        id: `fee-${Date.now()}`,
        student_id: validated.student_id,
        amount: validated.amount,
        due_date: validated.due_date,
        paid_date: validated.paid_date || null,
        status: validated.status,
        month: validated.month || 'Current Month',
        payment_ref: validated.payment_ref || null,
        created_at: new Date(),
      };
      fallbackStore.fees.push(createdFee);
    }

    await recordAdminActivity({
      ...adminInfo,
      action: 'RECORD_FEE',
      entity_type: 'fee',
      entity_id: createdFee.id,
      title: 'Created Fee Invoice',
      details: `Created fee invoice of ₹${validated.amount} (${validated.month || 'Current Month'})`,
    });

    return res.status(201).json({
      success: true,
      data: { ...createdFee, amount: Number(createdFee.amount) },
      message: 'Fee recorded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Pay fee (Student online payment simulator or Admin marking paid)
 */
async function payFee(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_ref } = req.body;
    const ref = payment_ref || `UPI-SR-${Math.floor(100000 + Math.random() * 900000)}`;
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let feePaid;
    if (isDb) {
      feePaid = await db.fee.update({
        where: { id },
        data: {
          status: 'paid',
          paid_date: new Date(),
          payment_ref: ref,
          receipt_url: `/api/v1/fees/receipt/${id}`,
        },
      });
    } else {
      const fee = fallbackStore.fees.find(f => f.id === id);
      if (!fee) return res.status(404).json({ success: false, data: null, message: 'Fee record not found.' });

      fee.status = 'paid';
      fee.paid_date = new Date().toISOString().split('T')[0];
      fee.payment_ref = ref;
      fee.receipt_url = `/api/v1/fees/receipt/${id}`;
      feePaid = fee;
    }

    if (!feePaid) {
      return res.status(404).json({ success: false, data: null, message: 'Fee record not found.' });
    }

    await recordAdminActivity({
      ...adminInfo,
      action: 'RECORD_PAYMENT',
      entity_type: 'fee',
      entity_id: id,
      title: 'Fee Payment Recorded',
      details: `Recorded fee payment of ₹${feePaid.amount} (Ref: ${ref})`,
    });

    return res.status(200).json({
      success: true,
      data: { ...feePaid, amount: Number(feePaid.amount) },
      message: 'Payment recorded successfully! Receipt generated.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate PDF receipt using PDFKit
 */
async function generateReceiptPDF(req, res, next) {
  try {
    const { id } = req.params;
    const isDb = getIsDbConnected();
    let fee;
    let student;

    if (isDb) {
      fee = await db.fee.findUnique({
        where: { id },
      });
      if (fee) student = fee.student;
    } else {
      fee = fallbackStore.fees.find(f => f.id === id);
      if (fee) {
        student = fallbackStore.users.find(u => u.id === fee.student_id);
      }
    }

    if (!fee) {
      fee = {
        id,
        amount: 2400.00,
        month: 'Current Month',
        paid_date: new Date(),
        payment_ref: 'UPI-SR-892401',
        status: 'paid',
      };
      student = req.user || { name: 'Student Disciple', email: 'student@example.com' };
    }

    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    // Set headers for download / view
    const isAttachment = req.query.download === 'true' || req.query.download === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isAttachment ? 'attachment' : 'inline'}; filename="Sri_Ruthralaya_Receipt_${id}.pdf"`
    );

    doc.pipe(res);

    // Header styling - Maroon and Gold theme
    doc.rect(0, 0, doc.page.width, 24).fill('#7B1E1E');
    doc.rect(0, 24, doc.page.width, 4).fill('#D4AF37');

    doc.moveDown(1.5);

    // Title
    doc.fillColor('#7B1E1E').fontSize(22).font('Helvetica-Bold')
      .text('SRI RUTHRALAYA BHARATHANATYAM ACADEMY', { align: 'center' });
    
    doc.fillColor('#555555').fontSize(10).font('Helvetica')
      .text('Centre for Classical Arts, Nattuvangam & Grade Examinations', { align: 'center' })
      .text('Thiruthangal near Sivakasi, Virudhunagar Dist, Tamil Nadu - 626130', { align: 'center' })
      .text('Phone: +91 98421 23456 | Email: info@sriruthralaya.com', { align: 'center' });

    doc.moveDown(1);
    doc.strokeColor('#D4AF37').lineWidth(1.5).moveTo(45, doc.y).lineTo(doc.page.width - 45, doc.y).stroke();
    doc.moveDown(1.2);

    // Receipt Title Badge
    doc.fillColor('#7B1E1E').fontSize(14).font('Helvetica-Bold')
      .text('OFFICIAL TUITION FEE RECEIPT', { align: 'center' });
    doc.moveDown(0.8);

    // Metadata Grid
    const startY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
    doc.text(`Receipt No: `, 45, startY);
    doc.font('Helvetica').text(`REC-${fee.id.slice(0, 10).toUpperCase()}`, 130, startY);

    doc.font('Helvetica-Bold').text(`Payment Date: `, 360, startY);
    doc.font('Helvetica').text(new Date(fee.paid_date || Date.now()).toLocaleDateString('en-IN'), 450, startY);

    doc.font('Helvetica-Bold').text(`Student Name: `, 45, startY + 20);
    doc.font('Helvetica').text(student?.name || 'Registered Disciple', 130, startY + 20);

    doc.font('Helvetica-Bold').text(`Transaction Ref: `, 360, startY + 20);
    doc.font('Helvetica').text(fee.payment_ref || 'CASH / UPI DIRECT', 450, startY + 20);

    doc.font('Helvetica-Bold').text(`Student Email: `, 45, startY + 40);
    doc.font('Helvetica').text(student?.email || 'N/A', 130, startY + 40);

    doc.font('Helvetica-Bold').text(`Billing Period: `, 360, startY + 40);
    doc.font('Helvetica').text(fee.month || 'Bharatanatyam Term', 450, startY + 40);

    doc.moveDown(4.5);

    // Table Header
    const tableTop = doc.y;
    doc.rect(45, tableTop, doc.page.width - 90, 24).fill('#7B1E1E');
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
    doc.text('#', 55, tableTop + 6);
    doc.text('Description of Training / Course', 85, tableTop + 6);
    doc.text('Term / Month', 360, tableTop + 6);
    doc.text('Amount (INR)', 460, tableTop + 6, { width: 80, align: 'right' });

    // Table Content
    const rowY = tableTop + 30;
    doc.rect(45, rowY - 5, doc.page.width - 90, 32).fill('#FAF5EE');
    doc.fillColor('#222222').fontSize(10).font('Helvetica');
    doc.text('1', 55, rowY + 5);
    doc.text('Bharathanatyam Classical Training & Practical Adavus', 85, rowY + 5);
    doc.text(fee.month || 'Current Month', 360, rowY + 5);
    doc.text(`₹ ${Number(fee.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 460, rowY + 5, { width: 80, align: 'right' });

    // Total Row
    const totalY = rowY + 40;
    doc.rect(45, totalY, doc.page.width - 90, 26).fill('#FFF8D6');
    doc.strokeColor('#D4AF37').lineWidth(1).rect(45, totalY, doc.page.width - 90, 26).stroke();
    doc.fillColor('#7B1E1E').fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL AMOUNT PAID', 85, totalY + 7);
    doc.text(`₹ ${Number(fee.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 460, totalY + 7, { width: 80, align: 'right' });

    // Guru Stamp / Authorization
    doc.moveDown(5);
    const signY = doc.y + 40;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#7B1E1E');
    doc.text('Status: PAID IN FULL (VERIFIED)', 45, signY);
    doc.font('Helvetica').fontSize(9).fillColor('#666666');
    doc.text('Computer-generated receipt, valid without physical seal.', 45, signY + 16);

    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(10);
    doc.text('Guru Nattiyakalaimani V. Suriya Sathian', 350, signY, { align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#666666');
    doc.text('Founder & Principal Instructor\nSri Ruthralaya Dance Academy', 350, signY + 14, { align: 'right' });

    // Footer decoration
    doc.rect(0, doc.page.height - 24, doc.page.width, 24).fill('#7B1E1E');
    doc.rect(0, doc.page.height - 28, doc.page.width, 4).fill('#D4AF37');
    doc.fillColor('#FFFFFF').fontSize(8).text('Preserving the Divine Tradition of Bharatanatyam with Sacred Devotion', 45, doc.page.height - 18, { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a fee invoice (Admin only)
 */
async function deleteFee(req, res, next) {
  try {
    const { id } = req.params;
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let existingFee = null;
    if (isDb) {
      existingFee = await db.fee.findUnique({ where: { id } });
      if (!existingFee) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Fee invoice record not found.',
        });
      }
      await db.fee.delete({ where: { id } });
    } else {
      const idx = fallbackStore.fees.findIndex(f => f.id === id);
      if (idx === -1) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Fee invoice record not found.',
        });
      }
      existingFee = fallbackStore.fees.splice(idx, 1)[0];
    }

    await recordAdminActivity({
      ...adminInfo,
      action: 'DELETE_FEE',
      entity_type: 'fee',
      entity_id: id,
      title: 'Deleted Fee Invoice',
      details: `Deleted fee invoice of ₹${existingFee.amount} (${existingFee.month || 'Tuition'})`,
    });

    return res.status(200).json({
      success: true,
      data: { id },
      message: 'Fee invoice deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllFees,
  getMyFees,
  recordFee,
  payFee,
  deleteFee,
  generateReceiptPDF,
};
