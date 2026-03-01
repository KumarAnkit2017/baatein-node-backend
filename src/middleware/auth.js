const { StatusCodes } = require('http-status-codes');
const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);
    const result = await pool.query(
      'SELECT id, name, email, mobile_number, avatar, bio, is_active FROM users WHERE id = $1 LIMIT 1',
      [decoded.sub]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid session' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email || '',
      mobileNumber: user.mobile_number || '',
      avatar: user.avatar,
      bio: user.bio
    };

    return next();
  } catch {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
  }
};

module.exports = auth;