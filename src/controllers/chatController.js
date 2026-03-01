const { StatusCodes } = require('http-status-codes');
const { pool } = require('../config/db');

const mapMessage = (row) => ({
  _id: row.id,
  sender: row.sender_id,
  recipient: row.recipient_id,
  group: row.group_id,
  content: row.content,
  messageType: row.message_type,
  createdAt: row.created_at
});

const sendPrivateMessage = async (req, res) => {
  const { recipientId, content, messageType } = req.body;
  const inserted = await pool.query(
    `INSERT INTO messages (sender_id, recipient_id, content, message_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, recipient_id, group_id, content, message_type, created_at`,
    [req.user.id, recipientId, content, messageType]
  );

  return res.status(StatusCodes.CREATED).json(mapMessage(inserted.rows[0]));
};

const getPrivateMessages = async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(
    `SELECT id, sender_id, recipient_id, group_id, content, message_type, created_at
     FROM messages
     WHERE group_id IS NULL
       AND ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1))
     ORDER BY created_at ASC`,
    [req.user.id, userId]
  );

  return res.status(StatusCodes.OK).json(result.rows.map(mapMessage));
};

const createGroup = async (req, res) => {
  const { name, description, memberIds } = req.body;
  const uniqueMembers = [...new Set([req.user.id, ...(memberIds || [])])];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      `INSERT INTO groups (name, description, admin_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, admin_id, created_at, updated_at`,
      [name, description, req.user.id]
    );

    const group = groupResult.rows[0];

    for (const memberId of uniqueMembers) {
      await client.query(
        `INSERT INTO group_members (group_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [group.id, memberId]
      );
    }

    await client.query('COMMIT');
    return res.status(StatusCodes.CREATED).json({
      _id: group.id,
      name: group.name,
      description: group.description,
      admin: group.admin_id,
      members: uniqueMembers,
      createdAt: group.created_at,
      updatedAt: group.updated_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const sendGroupMessage = async (req, res) => {
  const { groupId, content, messageType } = req.body;
  const member = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
    [groupId, req.user.id]
  );

  if (!member.rowCount) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'You are not a member of this group' });
  }

  const inserted = await pool.query(
    `INSERT INTO messages (sender_id, group_id, content, message_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, recipient_id, group_id, content, message_type, created_at`,
    [req.user.id, groupId, content, messageType]
  );

  return res.status(StatusCodes.CREATED).json(mapMessage(inserted.rows[0]));
};

const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  const member = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
    [groupId, req.user.id]
  );

  if (!member.rowCount) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'You are not a member of this group' });
  }

  const result = await pool.query(
    `SELECT id, sender_id, recipient_id, group_id, content, message_type, created_at
     FROM messages
     WHERE group_id = $1
     ORDER BY created_at ASC`,
    [groupId]
  );

  return res.status(StatusCodes.OK).json(result.rows.map(mapMessage));
};

const listMyGroups = async (req, res) => {
  const result = await pool.query(
    `SELECT g.id AS _id, g.name, g.description, g.admin_id AS admin, g.created_at AS "createdAt", g.updated_at AS "updatedAt"
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.updated_at DESC`,
    [req.user.id]
  );

  return res.status(StatusCodes.OK).json(result.rows);
};

module.exports = {
  sendPrivateMessage,
  getPrivateMessages,
  createGroup,
  sendGroupMessage,
  getGroupMessages,
  listMyGroups
};
