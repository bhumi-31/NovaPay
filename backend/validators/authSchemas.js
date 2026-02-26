const Joi = require('joi');

/**
 * All schemas use ALLOWLIST mode:
 * - Only defined fields are accepted
 * - Unknown fields are REJECTED, not silently stripped
 * - Type coercion is disabled at the middleware level
 */

const registerSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email address',
        'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).max(128).required().messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must not exceed 128 characters',
        'any.required': 'Password is required',
    }),
    name: Joi.string().trim().max(100).optional(),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email address',
        'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
    }),
});

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required',
    }),
});


const forceLogoutSchema = Joi.object({
    userId: Joi.string().required().messages({
        'any.required': 'User ID is required',
    }),
});

module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    forceLogoutSchema,
};
