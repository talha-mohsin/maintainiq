// backend/src/middlewares/validateBody.js

/**
 * Middleware factory to validate request bodies using Joi schemas.
 * Throws a ValidationError (from ApiError) on validation failure.
 */
import Joi from 'joi';
import { ValidationError } from '../utils/ApiError.js';

export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map(d => d.message).join(', ');
      throw new ValidationError(message);
    }
    req.body = value;
    next();
  };
};

export const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),
  register: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),
  createUser: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Technician').required(),
  }),
  assetCreate: Joi.object({
    assetName: Joi.string().required(),
    assetCode: Joi.string().required(),
    category: Joi.string().required(),
    location: Joi.string().required(),
    condition: Joi.string().optional(),
    assignedTechnician: Joi.string().optional().allow(null, ''),
    nextService: Joi.string().optional().allow(null, ''),
  }),
  assetUpdate: Joi.object({
    assetName: Joi.string().optional(),
    category: Joi.string().optional(),
    location: Joi.string().optional(),
    condition: Joi.string().optional(),
    status: Joi.string().optional(),
    assignedTechnician: Joi.string().optional().allow(null, ''),
    nextService: Joi.string().optional().allow(null, ''),
  }),
  issueCreate: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    priority: Joi.string().required(),
    category: Joi.string().required(),
    assetId: Joi.string().required(),
    reporter: Joi.string().required(),
    aiGenerated: Joi.boolean().optional(),
    possibleCauses: Joi.array().items(Joi.string()).optional(),
    initialChecks: Joi.array().items(Joi.string()).optional(),
    safetyWarning: Joi.string().allow('').optional(),
    imageEvidence: Joi.string().allow(null, '').optional(),
  }),
};
