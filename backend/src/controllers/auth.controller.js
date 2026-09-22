/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ValidationError, AuthError, NotFoundError, ConflictError, ApiError } from '../utils/ApiError.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
  console.warn('⚠️  JWT_SECRET is not set. Using temporary dev-only secret.');
}

const EFFECTIVE_SECRET = JWT_SECRET || 'dev-only-secret-not-for-production-use';

function issueAuthCookie(res, user) {
  const token = jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    EFFECTIVE_SECRET,
    { expiresIn: '24h' }
  );

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,                    // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax', // strict in production (same-domain), lax in dev
    maxAge: 24 * 60 * 60 * 1000,            // 1 day
  });
  return token;
}

function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

// Public self-registration. Always creates a Technician account — Admin
// accounts represent facility-management trust and must be provisioned by
// an existing Admin via POST /api/auth/users, never granted by self-signup.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newUser = new User({
    _id: `usr-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: 'Technician',
    avatar: null,
    createdAt: new Date()
  });
  await newUser.save();

  issueAuthCookie(res, newUser);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    errorCode: null,
    data: { user: toSafeUser(newUser) }
  });
});

// Admin-only: provision another Admin or Technician account.
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newUser = new User({
    _id: `usr-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role,
    avatar: null,
    createdAt: new Date()
  });
  await newUser.save();

  res.status(201).json({
    success: true,
    message: `${role} account created successfully`,
    errorCode: null,
    data: { user: toSafeUser(newUser) }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ValidationError('Please enter both email and password');
  }

  try {
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user || !user.password) {
      throw new AuthError('Invalid email or password');
    }

    const matches = bcrypt.compareSync(password, user.password);
    if (!matches) {
      throw new AuthError('Invalid email or password');
    }

    const token = issueAuthCookie(res, user);
    res.json({ success: true, message: 'Login successful', errorCode: null, data: { user: toSafeUser(user), token } });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Login error:", err);
    throw new ApiError('Server error during login', 500, 'ERR_INTERNAL');
  }
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Successfully logged out', errorCode: null, data: null });
});

export const me = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json({ success: true, message: 'User retrieved', errorCode: null, data: { user: toSafeUser(user) } });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Me retrieval error:", err);
    throw new ApiError('Server error retrieving current user', 500, 'ERR_INTERNAL');
  }
});

export const getTechnicians = asyncHandler(async (req, res) => {
  try {
    const technicians = await User.find({ role: 'Technician' });
    const safeTechnicians = technicians.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      createdAt: u.createdAt
    }));
    res.json({ technicians: safeTechnicians });
  } catch (err) {
    console.error("Get technicians error:", err);
    throw new ApiError('Server error retrieving technicians', 500, 'ERR_INTERNAL');
  }
});
