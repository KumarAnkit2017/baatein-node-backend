const { StatusCodes } = require('http-status-codes');

const notFound = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({ message: 'Route not found' });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Server error';
  return res.status(status).json({ message });
};

module.exports = { notFound, errorHandler };