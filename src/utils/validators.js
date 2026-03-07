const Joi = require('joi');

const idSchema = Joi.string().hex().length(24);
const phoneSchema = Joi.string().pattern(/^\+?[1-9]\d{9,14}$/);

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  mobileNumber: phoneSchema.optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const requestOtpSchema = Joi.object({
  mobileNumber: phoneSchema.required()
});

const verifyOtpSchema = Joi.object({
  mobileNumber: phoneSchema.required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  name: Joi.string().min(2).max(80).optional()
});

const profileSchema = Joi.object({
  name: Joi.string().min(2).max(80),
  bio: Joi.string().max(250),
  avatar: Joi.string().uri()
});

const privateMessageSchema = Joi.object({
  recipientId: idSchema.required(),
  content: Joi.string().min(1).max(4000).required(),
  messageType: Joi.string().valid('text', 'image', 'file').default('text')
});

const createGroupSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  description: Joi.string().max(300).allow('').default(''),
  memberIds: Joi.array().items(idSchema).default([])
});

const groupMessageSchema = Joi.object({
  groupId: idSchema.required(),
  content: Joi.string().min(1).max(4000).required(),
  messageType: Joi.string().valid('text', 'image', 'file').default('text')
});

module.exports = {
  registerSchema,
  loginSchema,
  requestOtpSchema,
  verifyOtpSchema,
  profileSchema,
  privateMessageSchema,
  createGroupSchema,
  groupMessageSchema
};