const { verifyToken } = require('../utils/jwt');
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

const setupSockets = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const decoded = verifyToken(token);
      socket.userId = decoded.sub;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.userId}`);

    try {
      const groupResult = await pool.query('SELECT group_id FROM group_members WHERE user_id = $1', [socket.userId]);
      groupResult.rows.forEach((g) => socket.join(`group:${g.group_id}`));
    } catch {
      // no-op: connection stays alive even if group join query fails once
    }

    socket.on('private:message', async (payload) => {
      try {
        const { recipientId, content, messageType = 'text' } = payload;
        if (!recipientId || !content) return;

        const inserted = await pool.query(
          `INSERT INTO messages (sender_id, recipient_id, content, message_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id, sender_id, recipient_id, group_id, content, message_type, created_at`,
          [socket.userId, recipientId, content, messageType]
        );

        const message = mapMessage(inserted.rows[0]);
        io.to(`user:${recipientId}`).to(`user:${socket.userId}`).emit('private:message:new', message);
      } catch {
        // ignore invalid socket payloads/errors
      }
    });

    socket.on('private:activity', ({ toUserId, activity = 'typing' }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit('private:activity', {
        fromUserId: socket.userId,
        activity
      });
    });

    socket.on('group:message', async (payload) => {
      try {
        const { groupId, content, messageType = 'text' } = payload;
        if (!groupId || !content) return;

        const member = await pool.query(
          'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
          [groupId, socket.userId]
        );
        if (!member.rowCount) return;

        const inserted = await pool.query(
          `INSERT INTO messages (sender_id, group_id, content, message_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id, sender_id, recipient_id, group_id, content, message_type, created_at`,
          [socket.userId, groupId, content, messageType]
        );

        io.to(`group:${groupId}`).emit('group:message:new', mapMessage(inserted.rows[0]));
      } catch {
        // ignore invalid socket payloads/errors
      }
    });

    socket.on('group:activity', async ({ groupId, activity = 'typing' }) => {
      if (!groupId) return;
      try {
        const member = await pool.query(
          'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
          [groupId, socket.userId]
        );
        if (!member.rowCount) return;
        socket.to(`group:${groupId}`).emit('group:activity', {
          fromUserId: socket.userId,
          groupId,
          activity
        });
      } catch {
        // no-op
      }
    });

    socket.on('call:signal', ({ toUserId, signal, callType = 'video' }) => {
      io.to(`user:${toUserId}`).emit('call:signal', {
        fromUserId: socket.userId,
        signal,
        callType
      });
    });
  });
};

module.exports = { setupSockets };
