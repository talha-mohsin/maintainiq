/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Issue from '../models/Issue.js';
import { ForbiddenError, NotFoundError } from '../utils/ApiError.js';

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
};

/**
 * Loads the target issue onto req.issue and enforces the mandatory scope rule:
 * Admins may act on any issue; Technicians may only act on an issue assigned to them.
 */
export const authorizeIssueAccess = () => {
  return async (req, res, next) => {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      throw new NotFoundError('Issue not found.');
    }

    if (req.userRole !== 'Admin' && issue.assignedTechnician !== req.userId) {
      throw new ForbiddenError('You may only update or resolve issues assigned to you.');
    }

    req.issue = issue;
    next();
  };
};
