const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const { db, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { sendPasswordResetEmail, isEmailConfigured } = require('../services/emailService');

// Zod validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  batch_id: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().min(4, 'OTP must be provided'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

/**
 * Register a new student (default status: pending)
 */
async function register(req, res, next) {
  try {
    const validated = registerSchema.parse(req.body);
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const existingUser = await db.user.findUnique({
        where: { email: validated.email.toLowerCase() },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'An account with this email address already exists.',
        });
      }

      const salt = await bcrypt.genSalt(12);
      const password_hash = await bcrypt.hash(validated.password, salt);

      const newUser = await db.user.create({
        data: {
          name: validated.name,
          email: validated.email.toLowerCase(),
          password_hash,
          phone: validated.phone || null,
          role: 'student',
          status: 'pending', // Pending Admin Approval
        },
      });

      if (validated.batch_id) {
        await db.enrollment.create({
          data: {
            student_id: newUser.id,
            batch_id: validated.batch_id,
            status: 'pending',
          },
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
        },
        message: 'Registration submitted successfully! Your account is pending admin approval. You will receive access once verified.',
      });
    } else {
      // Local development fallback
      const existingUser = fallbackStore.users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'An account with this email address already exists.',
        });
      }

      const salt = await bcrypt.genSalt(12);
      const password_hash = await bcrypt.hash(validated.password, salt);

      const newUser = {
        id: `usr-stu-${Date.now()}`,
        name: validated.name,
        email: validated.email.toLowerCase(),
        password_hash,
        phone: validated.phone || '',
        role: 'student',
        status: 'pending',
        created_at: new Date(),
      };
      fallbackStore.users.push(newUser);

      if (validated.batch_id) {
        fallbackStore.enrollments.push({
          id: `enr-${Date.now()}`,
          student_id: newUser.id,
          batch_id: validated.batch_id,
          joined_date: new Date(),
          status: 'pending',
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
        },
        message: 'Registration submitted successfully! Your account is pending admin approval. You will receive access once verified.',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Login user (admin, student, or staff)
 */
async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let user;
    if (isDb) {
      user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } else {
      user = fallbackStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid email address or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid email address or password.',
      });
    }

    // Check account status
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Your registration is still pending approval by the academy administrator. Please contact Guru V. Suriya Sathian or office administration.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Your account is currently inactive. Please contact the academy office to reactivate.',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profile_photo_url: user.profile_photo_url,
      status: user.status,
    };

    if (user.role === 'admin') {
      const adminInfo = getAdminInfoFromReq(req);
      await recordAdminActivity({
        ...adminInfo,
        admin_id: user.id,
        admin_name: user.name,
        admin_email: user.email,
        action: 'ADMIN_LOGIN',
        entity_type: 'auth',
        entity_id: user.id,
        title: 'Admin Session Started',
        details: `Administrator ${user.name} logged into the academy executive portal`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: safeUser,
      },
      message: `Welcome back, ${user.name}! Successfully signed in.`,
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Refresh Access Token using httpOnly cookie
 */
async function refreshToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Refresh token not found. Please log in again.',
      });
    }

    const decoded = verifyRefreshToken(token);
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let user;
    if (isDb) {
      user = await db.user.findUnique({ where: { id: decoded.id } });
    } else {
      user = fallbackStore.users.find(u => u.id === decoded.id);
    }

    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'User no longer active or valid.',
      });
    }

    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
      message: 'Access token refreshed successfully.',
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Invalid or expired refresh token. Please sign in again.',
    });
  }
}

/**
 * Logout
 */
async function logout(req, res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  return res.status(200).json({
    success: true,
    data: null,
    message: 'Signed out successfully.',
  });
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.id;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable.',
      });
    }

    let user;
    if (isDb) {
      user = await db.user.findUnique({
        where: { id: userId },
        include: { enrollments: true },
      });
    } else {
      const u = fallbackStore.users.find(usr => usr.id === userId);
      if (u) {
        const enr = fallbackStore.enrollments
          .filter(e => e.student_id === userId)
          .map(e => ({
            ...e,
            batch: fallbackStore.batches.find(b => b.id === e.batch_id),
          }));
        user = { ...u, enrollments: enr };
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User profile not found.',
      });
    }

    const { password_hash, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      data: safeUser,
      message: 'User profile retrieved.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Forgot password - request reset OTP
 * Generates secure random single-use OTP, hashes it, stores expiry,
 * and does not reveal whether the account exists.
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    // Check if account exists without leaking information to caller
    let user;
    if (isDb) {
      user = await db.user.findUnique({ where: { email: normalizedEmail } });
    } else {
      user = fallbackStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
    }

    let emailResult = null;

    if (user) {
      // Generate secure 6-digit random OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

      // Store hashed OTP in database
      await db.passwordReset.createReset({
        email: normalizedEmail,
        otpHash,
        expiresAt,
      });

      // Dispatch verification email via SMTP/Gmail
      emailResult = await sendPasswordResetEmail(normalizedEmail, otp);
    }

    // If SMTP is not configured, inform the user with the generated code so they are not blocked
    if (emailResult && !emailResult.delivered) {
      return res.status(200).json({
        success: true,
        data: {
          devOtp: emailResult.otp,
          emailDelivered: false,
        },
        message: `Verification code: ${emailResult.otp} (SMTP email service not configured on server).`,
      });
    }

    // Generic safe response to prevent user enumeration
    return res.status(200).json({
      success: true,
      data: {
        emailDelivered: true,
      },
      message: 'If an account exists for this email, a verification code has been dispatched to your inbox.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password with verified OTP
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    // Look up active password reset record
    const resetRecord = await db.passwordReset.findValid({ email: normalizedEmail });
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid or expired verification code. Please request a new code.',
      });
    }

    // Verify OTP against stored hash
    const isMatch = await bcrypt.compare(otp, resetRecord.otp_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    if (isDb) {
      await db.user.update({
        where: { email: normalizedEmail },
        data: { password_hash },
      });
    } else {
      const idx = fallbackStore.users.findIndex(u => u.email.toLowerCase() === normalizedEmail);
      if (idx !== -1) {
        fallbackStore.users[idx].password_hash = password_hash;
      }
    }

    // Invalidate the reset token (single-use)
    await db.passwordReset.invalidate({ id: resetRecord.id });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Password reset successfully. You can now log in with your new credentials.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
