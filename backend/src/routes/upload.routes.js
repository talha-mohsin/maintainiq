/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import multer from 'multer';
import { getCloudinary } from '../config/cloudinary.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Get lazy-initialized Cloudinary instance
  const cloudinaryInstance = getCloudinary();
  if (!cloudinaryInstance) {
    console.warn("⚠️ Cloudinary is not configured. Falling back to high-fidelity Unsplash placeholder.");
    return res.json({ 
      url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
      message: 'Cloudinary not configured. Fallback placeholder returned.'
    });
  }

  try {
    // Convert memory buffer to base64 for Cloudinary upload
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinaryInstance.uploader.upload(base64Image, {
      folder: 'maintainiq_evidence',
      resource_type: 'auto'
    });

    res.json({ url: result.secure_url });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ error: 'Failed to upload image to Cloudinary.' });
  }
});

export default router;
