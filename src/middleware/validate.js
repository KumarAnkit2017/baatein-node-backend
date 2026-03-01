const { StatusCodes } = require('http-status-codes');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Validation failed',
      details: error.details.map((d) => d.message)
    });
  }

  req.body = value;
  return next();
};

module.exports = validate;