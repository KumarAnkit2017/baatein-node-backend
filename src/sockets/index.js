const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const Group = require('../models/Group');

const emitToGroupMembers = (io, group, eventName, payload, excludeUserId = null) => {
  if (!group?.members?.length) return;
  group.members.forEach((memberId) => {
    if (excludeUserId && String(memberId) === String(excludeUserId)) return;
    io.to(`user:${memberId}`).emit(eventName, payload);
  });
};

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
      const groups = await Group.find({ members: socket.userId }, { _id: 1 }).lean();
      groups.forEach((g) => socket.join(`group:${g._id}`));
    } catch {
      // no-op
    }

    socket.on('private:message', async (payload) => {
      try {
        const { recipientId, content, messageType = 'text' } = payload;
        if (!recipientId || !content) return;

        const message = await Message.create({
          sender: socket.userId,
          recipient: recipientId,
          content,
          messageType
        });

        io.to(`user:${recipientId}`).to(`user:${socket.userId}`).emit('private:message:new', message);
      } catch {
        // ignore payload errors
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

        const group = await Group.findById(groupId).lean();
        if (!group || !group.members.some((m) => String(m) === String(socket.userId))) return;

        const message = await Message.create({
          sender: socket.userId,
          group: groupId,
          content,
          messageType
        });

        emitToGroupMembers(io, group, 'group:message:new', message);
        io.to(`group:${groupId}`).emit('group:message:new', message);
      } catch {
        // ignore payload errors
      }
    });

    socket.on('group:activity', async ({ groupId, activity = 'typing' }) => {
      if (!groupId) return;
      try {
        const group = await Group.findById(groupId).lean();
        if (!group || !group.members.some((m) => String(m) === String(socket.userId))) return;

        emitToGroupMembers(
          io,
          group,
          'group:activity',
          {
            fromUserId: socket.userId,
            groupId,
            activity
          },
          socket.userId
        );
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
