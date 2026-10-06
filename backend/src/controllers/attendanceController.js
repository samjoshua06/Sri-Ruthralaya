const crypto = require('crypto');
const { z } = require('zod');
const { db, queryPg, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');

const markAttendanceSchema = z.object({
  batch_id: z.string(),
  date: z.string(), // YYYY-MM-DD
  records: z.array(
    z.object({
      student_id: z.string(),
      status: z.enum(['present', 'absent', 'late']),
      remarks: z.string().optional(),
    })
  ),
});

/**
 * Mark attendance for an entire batch on a specific date
 */
async function markBatchAttendance(req, res, next) {
  try {
    const { batch_id, date, records } = markAttendanceSchema.parse(req.body);
    const dateStr = date.split('T')[0];
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
      const results = [];
      for (const rec of records) {
        const item = await db.attendance.upsert({
          where: {
            student_id: rec.student_id,
            batch_id,
            date: dateStr,
          },
          update: {
            status: rec.status,
            remarks: rec.remarks || null,
          },
          create: {
            student_id: rec.student_id,
            batch_id,
            date: dateStr,
            status: rec.status,
            remarks: rec.remarks || null,
          },
        });
        results.push(item);
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'MARK_ATTENDANCE',
        entity_type: 'attendance',
        entity_id: batch_id,
        title: 'Batch Attendance Marked',
        details: `Logged attendance for ${results.length} students on date ${date}`,
      });

      return res.status(200).json({
        success: true,
        data: results,
        message: `Attendance marked for ${results.length} students on ${date}.`,
      });
    } else {
      const dateStr = date.split('T')[0];
      const results = [];

      for (const rec of records) {
        const existingIdx = fallbackStore.attendances.findIndex(
          a => a.student_id === rec.student_id && a.batch_id === batch_id && a.date === dateStr
        );

        if (existingIdx !== -1) {
          fallbackStore.attendances[existingIdx].status = rec.status;
          fallbackStore.attendances[existingIdx].remarks = rec.remarks || null;
          results.push(fallbackStore.attendances[existingIdx]);
        } else {
          const newAtt = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            student_id: rec.student_id,
            batch_id,
            date: dateStr,
            status: rec.status,
            remarks: rec.remarks || null,
            created_at: new Date(),
          };
          fallbackStore.attendances.push(newAtt);
          results.push(newAtt);
        }
      }

      await recordAdminActivity({
        ...adminInfo,
        action: 'MARK_ATTENDANCE',
        entity_type: 'attendance',
        entity_id: batch_id,
        title: 'Batch Attendance Marked',
        details: `Logged attendance for ${results.length} students on date ${dateStr}`,
      });

      return res.status(200).json({
        success: true,
        data: results,
        message: `Attendance recorded for ${results.length} students on ${dateStr}.`,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Bulk upload attendance via CSV data
 */
async function bulkUploadCSV(req, res, next) {
  try {
    const { csvData, rows } = req.body;
    let parsedRows = rows;

    if (!parsedRows && csvData) {
      const lines = csvData.trim().split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      parsedRows = lines.slice(1).map(line => {
        const parts = line.split(',').map(p => p.trim());
        const row = {};
        headers.forEach((h, i) => {
          row[h] = parts[i];
        });
        return row;
      });
    }

    if (!parsedRows || !Array.isArray(parsedRows) || parsedRows.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'No valid attendance rows provided in CSV upload.',
      });
    }

    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let processed = 0;

    for (const row of parsedRows) {
      const email = row.email || row.student_email;
      const studentId = row.student_id;
      const batchId = row.batch_id;
      const dateStr = row.date || new Date().toISOString().split('T')[0];
      const status = (row.status && ['present', 'absent', 'late'].includes(row.status.toLowerCase()))
        ? row.status.toLowerCase()
        : 'present';
      const remarks = row.remarks || 'CSV import';

      if (isDb) {
        let student;
        if (studentId) {
          student = await db.user.findUnique({ where: { id: studentId } });
        } else if (email) {
          student = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        }
        if (!student) continue;

        let bId = batchId;
        if (!bId) {
          const enr = await db.enrollment.findFirst({ where: { student_id: student.id } });
          bId = enr?.batch_id;
        }
        if (!bId) continue;

        await db.attendance.upsert({
          where: {
            student_id: student.id,
            batch_id: bId,
            date: new Date(dateStr),
          },
          update: { status, remarks },
          create: {
            student_id: student.id,
            batch_id: bId,
            date: new Date(dateStr),
            status,
            remarks,
          },
        });
        processed++;
      } else {
        let student;
        if (studentId) {
          student = fallbackStore.users.find(u => u.id === studentId);
        } else if (email) {
          student = fallbackStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        }
        if (!student) continue;

        let bId = batchId;
        if (!bId) {
          const enr = fallbackStore.enrollments.find(e => e.student_id === student.id);
          bId = enr?.batch_id;
        }
        if (!bId) continue;

        const d = dateStr.split('T')[0];
        const existingIdx = fallbackStore.attendances.findIndex(
          a => a.student_id === student.id && a.batch_id === bId && a.date === d
        );

        if (existingIdx !== -1) {
          fallbackStore.attendances[existingIdx].status = status;
          fallbackStore.attendances[existingIdx].remarks = remarks;
        } else {
          fallbackStore.attendances.push({
            id: `att-csv-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            student_id: student.id,
            batch_id: bId,
            date: d,
            status,
            remarks,
            created_at: new Date(),
          });
        }
        processed++;
      }
    }

    await recordAdminActivity({
      ...adminInfo,
      action: 'UPLOAD_ATTENDANCE_CSV',
      entity_type: 'attendance',
      title: 'Imported Attendance CSV',
      details: `Imported ${processed} attendance records via CSV spreadsheet upload`,
    });

    return res.status(200).json({
      success: true,
      data: { processedRows: processed },
      message: `Successfully imported ${processed} attendance records via CSV.`,
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Get attendance for a batch on a given date
 */
async function getBatchAttendanceByDate(req, res, next) {
  try {
    const { batch_id, date } = req.query;
    if (!batch_id || !date) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Both batch_id and date query parameters are required.',
      });
    }

    const isDb = getIsDbConnected();
    const dateStr = date.split('T')[0];

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const resQuery = await queryPg(
        `SELECT a.id, a.batch_id, a.student_id, a.status, a.remarks, to_char(a.date, 'YYYY-MM-DD') as date_str, a.date,
                u.name as student_name, u.email as student_email, u.profile_photo_url 
         FROM attendances a 
         JOIN users u ON a.student_id = u.id 
         WHERE a.batch_id = $1 AND a.date = $2::date`,
        [batch_id, dateStr]
      );

      const records = resQuery.rows.map(r => ({
        id: r.id,
        batch_id: r.batch_id,
        student_id: r.student_id,
        date: r.date_str || (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]),
        status: r.status,
        remarks: r.remarks,
        student: {
          id: r.student_id,
          name: r.student_name,
          email: r.student_email,
          profile_photo_url: r.profile_photo_url,
        }
      }));

      return res.status(200).json({
        success: true,
        data: records,
        message: 'Batch attendance retrieved.',
      });
    } else {
      const records = fallbackStore.attendances
        .filter(a => a.batch_id === batch_id && a.date === dateStr)
        .map(a => {
          const student = fallbackStore.users.find(u => u.id === a.student_id);
          return {
            ...a,
            student: student ? { id: student.id, name: student.name, email: student.email, profile_photo_url: student.profile_photo_url } : null,
          };
        });

      return res.status(200).json({
        success: true,
        data: records,
        message: 'Batch attendance retrieved.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get Student attendance history
 */
async function getStudentAttendance(req, res, next) {
  try {
    const student_id = req.params.student_id || req.user.id;
    const isDb = getIsDbConnected();
    const todayStr = new Date().toISOString().split('T')[0];

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const resQuery = await queryPg(
        `SELECT a.id, a.batch_id, a.student_id, a.status, a.remarks, a.created_at,
                to_char(a.date, 'YYYY-MM-DD') as date_str,
                a.date,
                b.name as batch_name, b.schedule_days, b.schedule_time 
         FROM attendances a 
         LEFT JOIN batches b ON a.batch_id = b.id 
         WHERE a.student_id = $1 
         ORDER BY a.date DESC`,
        [student_id]
      );

      const records = resQuery.rows.map(r => ({
        id: r.id,
        batch_id: r.batch_id,
        student_id: r.student_id,
        date: r.date_str || (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]),
        raw_date: r.date,
        status: r.status,
        remarks: r.remarks,
        batch: {
          id: r.batch_id,
          name: r.batch_name,
          schedule_days: r.schedule_days,
          schedule_time: r.schedule_time
        },
      }));

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const pct = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0;

      const todayRecord = records.find(r => r.date === todayStr);

      return res.status(200).json({
        success: true,
        data: {
          records,
          stats: { total, present, late, absent, attendancePercentage: pct, hasRecords: total > 0 },
          todayRecord: todayRecord || null,
        },
        message: 'Student attendance retrieved.',
      });
    } else {
      const records = fallbackStore.attendances
        .filter(a => a.student_id === student_id)
        .map(a => ({
          ...a,
          batch: fallbackStore.batches.find(b => b.id === a.batch_id) || { name: 'Bharatanatyam Core' },
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const pct = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0;

      const todayRecord = records.find(r => r.date === todayStr);

      return res.status(200).json({
        success: true,
        data: {
          records,
          stats: { total, present, late, absent, attendancePercentage: pct, hasRecords: total > 0 },
          todayRecord: todayRecord || null,
        },
        message: 'Student attendance retrieved.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Student self check-in / live attendance record for today's sadhana
 */
async function studentSelfCheckIn(req, res, next) {
  try {
    const student_id = req.user.id;
    const isDb = getIsDbConnected();
    const todayStr = new Date().toISOString().split('T')[0];

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      // Find active batch enrollment
      const enrRes = await queryPg(
        `SELECT e.batch_id, b.name as batch_name 
         FROM enrollments e 
         JOIN batches b ON e.batch_id = b.id 
         WHERE e.student_id = $1 AND e.status = 'active' 
         LIMIT 1`,
        [student_id]
      );

      let batch_id;
      if (enrRes.rows[0]) {
        batch_id = enrRes.rows[0].batch_id;
      } else {
        const defaultBatch = await queryPg("SELECT id FROM batches LIMIT 1");
        batch_id = defaultBatch.rows[0]?.id;
      }

      if (!batch_id) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'No active dance batch enrollment found for your account. Please contact academy admin.',
        });
      }

      // Check if attendance already marked today
      const existing = await queryPg(
        `SELECT id, status, remarks, to_char(date, 'YYYY-MM-DD') as date_str 
         FROM attendances 
         WHERE student_id = $1 AND date = $2 LIMIT 1`,
        [student_id, todayStr]
      );

      if (existing.rows.length > 0) {
        return res.status(200).json({
          success: true,
          data: existing.rows[0],
          alreadyMarked: true,
          message: `Your sadhana attendance for today (${todayStr}) is already recorded as "${existing.rows[0].status}".`,
        });
      }

      const newId = crypto.randomUUID();
      const insertRes = await queryPg(
        `INSERT INTO attendances (id, student_id, batch_id, date, status, remarks, created_at) 
         VALUES ($1, $2, $3, $4, 'present', 'Live Disciple Check-In via Student Portal', NOW()) 
         RETURNING id, student_id, batch_id, status, remarks, to_char(date, 'YYYY-MM-DD') as date_str, created_at`,
        [newId, student_id, batch_id, todayStr]
      );

      return res.status(201).json({
        success: true,
        data: insertRes.rows[0],
        alreadyMarked: false,
        message: 'Sadhana presence recorded live! Keep up the rhythm and dedication.',
      });
    } else {
      const batch = fallbackStore.batches[0];
      const newAtt = {
        id: `att-self-${Date.now()}`,
        student_id,
        batch_id: batch?.id || 'batch-1',
        date: todayStr,
        status: 'present',
        remarks: 'Live Disciple Check-In via Student Portal',
        created_at: new Date(),
      };
      fallbackStore.attendances.push(newAtt);

      return res.status(201).json({
        success: true,
        data: newAtt,
        alreadyMarked: false,
        message: 'Sadhana presence recorded live! Keep up the rhythm and dedication.',
      });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  markBatchAttendance,
  bulkUploadCSV,
  getBatchAttendanceByDate,
  getStudentAttendance,
  studentSelfCheckIn,
};
