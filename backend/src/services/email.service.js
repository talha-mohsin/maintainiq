/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log('📧 Email service configured — notifications will be sent via SMTP.');
} else {
  console.log('ℹ️ SMTP not configured. Email notifications will be logged, not sent.');
}

const FROM_ADDRESS = SMTP_FROM || SMTP_USER || 'notifications@maintainiq.local';

export const emailService = {
  /**
   * Notifies a technician that an issue has been assigned to them.
   * Fails soft — a broken mail server must never block the API request
   * that triggered it, so callers should not await this on the hot path.
   */
  async sendIssueAssignmentEmail({ to, technicianName, issue, assetName }) {
    if (!to) return;

    const subject = `[MaintainIQ] New issue assigned: ${issue.issueNumber}`;
    const text = [
      `Hi ${technicianName || 'there'},`,
      '',
      `You have been assigned to issue ${issue.issueNumber} on "${assetName}".`,
      '',
      `Title: ${issue.title}`,
      `Priority: ${issue.priority}`,
      `Description: ${issue.description}`,
      '',
      'Please log in to MaintainIQ to begin inspection.',
    ].join('\n');

    if (!transporter) {
      console.log(`ℹ️ [Email Simulation] Would send to ${to}: "${subject}"`);
      return;
    }

    try {
      await transporter.sendMail({ from: FROM_ADDRESS, to, subject, text });
      console.log(`📧 Assignment email sent to ${to} for ${issue.issueNumber}`);
    } catch (err) {
      console.warn(`⚠️ Failed to send assignment email to ${to}:`, err.message);
    }
  },
};
