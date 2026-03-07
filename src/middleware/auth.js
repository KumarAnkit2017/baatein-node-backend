const { StatusCodes } = require('http-status-codes');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub).lean();

    if (!user || !user.isActive) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid session' });
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email || '',
      mobileNumber: user.mobileNumber || '',
      avatar: user.avatar,
      bio: user.bio
    };

    return next();
  } catch {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
  }
};

module.exports = auth;