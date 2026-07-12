/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { v2 as cloudinary } from 'cloudinary';

let isCloudinaryConfigured = false;

export function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
    isCloudinaryConfigured = true;
    return cloudinary;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error("❌ CRITICAL PRODUCTION ERROR: Cloudinary configuration variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required in production mode (outside sandbox mode).");
  }

  return null;
}

export function isConfigured() {
  getCloudinary();
  return isCloudinaryConfigured;
}
