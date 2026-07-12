/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
};
