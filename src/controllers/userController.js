const { StatusCodes } = require('http-status-codes');
const { pool } = require('../config/db');

const getMe = async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, mobile_number, avatar, bio FROM users WHERE id = $1 LIMIT 1',
    [req.user.id]
  );

  const user = result.rows[0];
  return res.status(StatusCodes.OK).json({
    id: user.id,
    name: user.name,
    email: user.email || '',
    mobileNumber: user.mobile_number || '',
    avatar: user.avatar,
    bio: user.bio
  });
};

const updateMe = async (req, res) => {
  const { name, bio, avatar } = req.body;

  const result = await pool.query(
    `UPDATE users
     SET
       name = COALESCE($2, name),
       bio = COALESCE($3, bio),
       avatar = COALESCE($4, avatar),
       updated_at = now()
     WHERE id = $1
     RETURNING id, name, email, mobile_number, avatar, bio`,
    [req.user.id, name ?? null, bio ?? null, avatar ?? null]
  );

  const user = result.rows[0];
  return res.status(StatusCodes.OK).json({
    id: user.id,
    name: user.name,
    email: user.email || '',
    mobileNumber: user.mobile_number || '',
    avatar: user.avatar,
    bio: user.bio
  });
};

const listUsers = async (req, res) => {
  const result = await pool.query(
    'SELECT id AS _id, name, email, mobile_number AS "mobileNumber", avatar FROM users WHERE is_active = true ORDER BY created_at DESC'
  );
  return res.status(StatusCodes.OK).json(result.rows);
};

module.exports = { getMe, updateMe, listUsers };