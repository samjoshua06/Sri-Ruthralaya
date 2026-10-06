const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { db, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');

const studentCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  batch_id: z.string().optional(),
  status: z.enum(['pending', 'active', 'inactive']).default('active'),
  profile_photo_url: z.string().optional(),
});

/**
 * Get all students (Admin/Staff only)
 */
async function getAllStudents(req, res, next) {
  try {
    const { status, batch_id, search } = req.query;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const where = {
        role: 'student',
      };
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      let students = await db.user.findMany({
        where,
        include: {
          enrollments: true,
          fees: true,
          attendances: true,
        },
      });

      if (batch_id) {
        students = students.filter(s => s.enrollments && s.enrollments.some(e => e.batch_id === batch_id));
      }

      // Format with attendance % and fee status
      const formatted = students.map(s => {
        const attendances = s.attendances || [];
        const totalAtt = attendances.length;
        const presentAtt = attendances.filter(a => a.status === 'present').length;
        const attendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;
        const activeBatch = (s.enrollments && s.enrollments[0]?.batch) || null;
        const latestFee = (s.fees && s.fees[0]) || null;

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          status: s.status,
          profile_photo_url: s.profile_photo_url,
          created_at: s.created_at,
          batch: activeBatch ? { id: activeBatch.id, name: activeBatch.name, level: activeBatch.level } : null,
          attendancePct,
          feeStatus: latestFee ? latestFee.status : 'paid',
        };
      });

      return res.status(200).json({
        success: true,
        data: formatted,
        message: 'Students list fetched successfully.',
      });
    } else {
      // Development fallback
      let list = fallbackStore.users.filter(u => u.role === 'student');
      if (status) list = list.filter(u => u.status === status);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone && u.phone.includes(q)));
      }

      const formatted = list.map(s => {
        const enrs = fallbackStore.enrollments.filter(e => e.student_id === s.id);
        const batch = enrs.length > 0 ? fallbackStore.batches.find(b => b.id === enrs[0].batch_id) : null;
        const atts = fallbackStore.attendances.filter(a => a.student_id === s.id);
        const present = atts.filter(a => a.status === 'present').length;
        const attendancePct = atts.length > 0 ? Math.round((present / atts.length) * 100) : 92;
        const studentFees = fallbackStore.fees.filter(f => f.student_id === s.id);
        const latestFee = studentFees[studentFees.length - 1];

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          status: s.status,
          profile_photo_url: s.profile_photo_url,
          created_at: s.created_at,
          batch: batch ? { id: batch.id, name: batch.name, level: batch.level } : null,
          attendancePct,
          feeStatus: latestFee ? latestFee.status : 'paid',
        };
      });

      if (batch_id) {
        return res.status(200).json({
          success: true,
          data: formatted.filter(s => s.batch && s.batch.id === batch_id),
          message: 'Students list fetched.',
        });
      }

      return res.status(200).json({
        success: true,
        data: formatted,
        message: 'Students list fetched.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get Student details by ID
 */
async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    // Security check: Student can only view their own profile, unless admin/staff
    if (req.user.role === 'student' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Unauthorized: You can only access your own profile.',
      });
    }

    if (isDb) {
      const student = await db.user.findUnique({
        where: { id },
        include: {
          enrollments: true,
          attendances: true,
          fees: true,
        },
      });

      if (!student) {
        return res.status(404).json({ success: false, data: null, message: 'Student not found.' });
      }

      const attendances = student.attendances || [];
      const totalAtt = attendances.length;
      const presentCount = attendances.filter(a => a.status === 'present').length;
      const attendancePct = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 100;

      const { password_hash, ...safeData } = student;
      return res.status(200).json({
        success: true,
        data: {
          ...safeData,
          attendancePct,
          totalClasses: totalAtt,
          presentClasses: presentCount,
          activeBatch: (student.enrollments && student.enrollments[0]?.batch) || null,
        },
        message: 'Student details retrieved.',
      });
    } else {
      const student = fallbackStore.users.find(u => u.id === id);
      if (!student) {
        return res.status(404).json({ success: false, data: null, message: 'Student not found.' });
      }

      const enrollments = fallbackStore.enrollments
        .filter(e => e.student_id === id)
        .map(e => ({ ...e, batch: fallbackStore.batches.find(b => b.id === e.batch_id) }));
      const attendances = fallbackStore.attendances.filter(a => a.student_id === id);
      const fees = fallbackStore.fees.filter(f => f.student_id === id);

      const totalAtt = attendances.length;
      const presentCount = attendances.filter(a => a.status === 'present').length;
      const attendancePct = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 90;

      return res.status(200).json({
        success: true,
        data: {
          id: student.id,
          name: student.name,
          email: student.email,
          phone: student.phone,
          status: student.status,
          role: student.role,
          profile_photo_url: student.profile_photo_url,
          created_at: student.created_at,
          enrollments,
          activeBatch: enrollments[0]?.batch || null,
          attendances,
          fees,
          attendancePct,
          totalClasses: totalAtt,
          presentClasses: presentCount,
        },
        message: 'Student details retrieved.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Create new student directly by Admin
 */
async function createStudent(req, res, next) {
  try {
    const validated = studentCreateSchema.parse(req.body);
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash('Student@123', salt);
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const student = await db.user.create({
        data: {
          name: validated.name,
          email: validated.email.toLowerCase(),
          password_hash,
          phone: validated.phone || null,
          profile_photo_url: validated.profile_photo_url || null,
          status: validated.status || 'active',
          role: 'student',
        },
      });

      if (validated.batch_id) {
        await db.enrollment.create({
          data: {
            student_id: student.id,
            batch_id: validated.batch_id,
            status: 'active',
          },
        });
      }

      await recordAdminActivity({
        ...getAdminInfoFromReq(req),
        action: 'CREATE_STUDENT',
        entity_type: 'student',
        entity_id: student.id,
        title: 'Registered Student Account',
        details: `Enrolled student "${student.name}" (${student.email})`,
      });

      return res.status(201).json({
        success: true,
        data: student,
        message: 'Student created successfully. Default password is set to Student@123.',
      });
    } else {
      const newStu = {
        id: `usr-stu-${Date.now()}`,
        name: validated.name,
        email: validated.email.toLowerCase(),
        password_hash,
        phone: validated.phone || '',
        profile_photo_url: validated.profile_photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        status: validated.status || 'active',
        role: 'student',
        created_at: new Date(),
      };
      fallbackStore.users.push(newStu);

      if (validated.batch_id) {
        fallbackStore.enrollments.push({
          id: `enr-${Date.now()}`,
          student_id: newStu.id,
          batch_id: validated.batch_id,
          joined_date: new Date(),
          status: 'active',
        });
      }

      await recordAdminActivity({
        ...getAdminInfoFromReq(req),
        action: 'CREATE_STUDENT',
        entity_type: 'student',
        entity_id: newStu.id,
        title: 'Registered Student Account',
        details: `Enrolled student "${newStu.name}" (${newStu.email})`,
      });

      return res.status(201).json({
        success: true,
        data: newStu,
        message: 'Student created successfully. Default password is set to Student@123.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Approve pending student registration
 */
async function approveStudent(req, res, next) {
  try {
    const { id } = req.params;
    const { batch_id } = req.body;
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const student = await db.user.update({
        where: { id },
        data: { status: 'active' },
      });

      if (batch_id) {
        await db.enrollment.upsert({
          where: { student_id: id },
          update: { batch_id, status: 'active' },
          create: {
            student_id: id,
            batch_id,
            status: 'active',
          },
        });
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'APPROVE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Approved Student Registration',
        details: `Approved admission registration for "${student.name}"`,
      });

      return res.status(200).json({
        success: true,
        data: student,
        message: `Student ${student.name} approved successfully and marked active.`,
      });
    } else {
      const student = fallbackStore.users.find(u => u.id === id);
      if (!student) {
        return res.status(404).json({ success: false, data: null, message: 'Student not found.' });
      }
      student.status = 'active';

      if (batch_id) {
        const enr = fallbackStore.enrollments.find(e => e.student_id === id);
        if (enr) {
          enr.batch_id = batch_id;
          enr.status = 'active';
        } else {
          fallbackStore.enrollments.push({
            id: `enr-${Date.now()}`,
            student_id: id,
            batch_id,
            joined_date: new Date(),
            status: 'active',
          });
        }
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'APPROVE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Approved Student Registration',
        details: `Approved admission registration for "${student.name}"`,
      });

      return res.status(200).json({
        success: true,
        data: student,
        message: `Student ${student.name} approved successfully and marked active.`,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Update student profile
 */
async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, status, profile_photo_url, batch_id } = req.body;
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const updated = await db.user.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(status && { status }),
          ...(profile_photo_url && { profile_photo_url }),
        },
      });

      if (batch_id) {
        const existing = await db.enrollment.findFirst({ where: { student_id: id } });
        if (existing) {
          await db.enrollment.update({
            where: { id: existing.id },
            data: { batch_id },
          });
        } else {
          await db.enrollment.create({
            data: { student_id: id, batch_id, status: 'active' },
          });
        }
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'UPDATE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Updated Student Profile',
        details: `Updated profile details for "${updated.name}"`,
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Student details updated successfully.',
      });
    } else {
      const s = fallbackStore.users.find(u => u.id === id);
      if (!s) return res.status(404).json({ success: false, data: null, message: 'Student not found.' });
      if (name) s.name = name;
      if (phone !== undefined) s.phone = phone;
      if (status) s.status = status;
      if (profile_photo_url) s.profile_photo_url = profile_photo_url;

      if (batch_id) {
        const enr = fallbackStore.enrollments.find(e => e.student_id === id);
        if (enr) {
          enr.batch_id = batch_id;
        } else {
          fallbackStore.enrollments.push({
            id: `enr-${Date.now()}`,
            student_id: id,
            batch_id,
            joined_date: new Date(),
            status: 'active',
          });
        }
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'UPDATE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Updated Student Profile',
        details: `Updated profile details for "${s.name}"`,
      });

      return res.status(200).json({
        success: true,
        data: s,
        message: 'Student details updated successfully.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle student active/inactive status
 */
async function toggleStudentStatus(req, res, next) {
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

    if (isDb) {
      const student = await db.user.findUnique({ where: { id } });
      if (!student) return res.status(404).json({ success: false, data: null, message: 'Student not found.' });

      const newStatus = student.status === 'active' ? 'inactive' : 'active';
      const updated = await db.user.update({
        where: { id },
        data: { status: newStatus },
      });

      await recordAdminActivity({
        ...adminInfo,
        action: 'STATUS_CHANGE',
        entity_type: 'student',
        entity_id: id,
        title: 'Changed Student Status',
        details: `Changed status of "${student.name}" to ${newStatus}`,
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: `Student status updated to ${newStatus}.`,
      });
    } else {
      const student = fallbackStore.users.find(u => u.id === id);
      if (!student) return res.status(404).json({ success: false, data: null, message: 'Student not found.' });

      student.status = student.status === 'active' ? 'inactive' : 'active';

      await recordAdminActivity({
        ...adminInfo,
        action: 'STATUS_CHANGE',
        entity_type: 'student',
        entity_id: id,
        title: 'Changed Student Status',
        details: `Changed status of "${student.name}" to ${student.status}`,
      });

      return res.status(200).json({
        success: true,
        data: student,
        message: `Student status updated to ${student.status}.`,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Permanently delete student account (Admin only)
 */
async function deleteStudent(req, res, next) {
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

    if (isDb) {
      const student = await db.user.findUnique({ where: { id } });
      if (!student) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Student account not found.',
        });
      }

      // Clean up linked records in database before deleting user
      try {
        await db.$queryRaw('DELETE FROM enrollments WHERE student_id = $1', [id]);
        await db.$queryRaw('DELETE FROM attendances WHERE student_id = $1', [id]);
        await db.$queryRaw('DELETE FROM fees WHERE student_id = $1', [id]);
        await db.$queryRaw('DELETE FROM notices WHERE student_id = $1', [id]);
      } catch (cascadeErr) {
        console.warn('Cascade delete linked tables warning:', cascadeErr.message);
      }

      await db.user.delete({ where: { id } });

      await recordAdminActivity({
        ...adminInfo,
        action: 'DELETE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Deleted Student Account',
        details: `Permanently deleted student account for "${student.name}" (${student.email})`,
      });

      return res.status(200).json({
        success: true,
        data: { id },
        message: `Student account for ${student.name} deleted successfully.`,
      });
    } else {
      const idx = fallbackStore.users.findIndex(u => u.id === id);
      if (idx === -1) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Student account not found.',
        });
      }
      const student = fallbackStore.users.splice(idx, 1)[0];

      // Clean up related records in fallbackStore
      fallbackStore.enrollments = fallbackStore.enrollments.filter(e => e.student_id !== id);
      fallbackStore.attendances = fallbackStore.attendances.filter(a => a.student_id !== id);
      fallbackStore.fees = fallbackStore.fees.filter(f => f.student_id !== id);
      fallbackStore.notices = fallbackStore.notices.filter(n => n.student_id !== id);

      await recordAdminActivity({
        ...adminInfo,
        action: 'DELETE_STUDENT',
        entity_type: 'student',
        entity_id: id,
        title: 'Deleted Student Account',
        details: `Permanently deleted student account for "${student.name}" (${student.email})`,
      });

      return res.status(200).json({
        success: true,
        data: { id },
        message: `Student account for ${student.name} deleted successfully.`,
      });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  approveStudent,
  updateStudent,
  toggleStudentStatus,
  deleteStudent,
};
