const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');

const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  return res.status(StatusCodes.OK).json({
    id: user._id,
    name: user.name,
    email: user.email || '',
    mobileNumber: user.mobileNumber || '',
    avatar: user.avatar,
    bio: user.bio
  });
};

const updateMe = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { $set: req.body }, { new: true }).lean();
  return res.status(StatusCodes.OK).json({
    id: user._id,
    name: user.name,
    email: user.email || '',
    mobileNumber: user.mobileNumber || '',
    avatar: user.avatar,
    bio: user.bio
  });
};

const listUsers = async (req, res) => {
  const users = await User.find({ isActive: true }, { name: 1, email: 1, mobileNumber: 1, avatar: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(StatusCodes.OK).json(
    users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email || '',
      mobileNumber: u.mobileNumber || '',
      avatar: u.avatar
    }))
  );
};

module.exports = { getMe, updateMe, listUsers };