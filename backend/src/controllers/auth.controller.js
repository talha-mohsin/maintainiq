/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const JWT_SECRET = process.env.SECRET_KEY || process.env.JWT_SECRET || 'maintainiq-secure-fallback-secret-2026';

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both email and password' });
  }

  try {
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const matches = bcrypt.compareSync(password, user.password);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT token (valid for 24h)
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // Exclude password from response
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    };
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Successfully logged out' });
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    };
    res.json({ user: safeUser });
  } catch (err) {
    console.error("Me retrieval error:", err);
    res.status(500).json({ error: 'Server error retrieving current user' });
  }
};

export const getTechnicians = async (req, res) => {
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
    res.status(500).json({ error: 'Server error retrieving technicians' });
  }
};
