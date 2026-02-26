const Joi = require('joi');

const transferSchema = Joi.object({
    recipientEmail: Joi.string().email().required().messages({
        'string.email': 'Must be a valid recipient email',
        'any.required': 'Recipient email is required',
    }),
    amount: Joi.number().positive().precision(2).min(0.01).max(50000).required().messages({
        'number.positive': 'Amount must be positive',
        'number.min': 'Minimum transfer is $0.01',
        'number.max': 'Maximum transfer is $50,000',
        'any.required': 'Amount is required',
    }),
    description: Joi.string().trim().max(200).optional().allow(''),
});

const depositSchema = Joi.object({
    amount: Joi.number().positive().precision(2).min(1).max(500).required().messages({
        'number.positive': 'Amount must be positive',
        'number.min': 'Minimum deposit is $1.00',
        'number.max': 'Maximum deposit is $500',
        'any.required': 'Amount is required',
    }),
});

const transactionsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    type: Joi.string().valid('transfer', 'deposit', 'withdrawal').optional(),
});

module.exports = {
    transferSchema,
    depositSchema,
    transactionsQuerySchema,
};
