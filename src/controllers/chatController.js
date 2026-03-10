const { StatusCodes } = require('http-status-codes');
const Message = require('../models/Message');
const Group = require('../models/Group');

const toGroupResponse = (groupDoc) => ({
  _id: groupDoc._id,
  name: groupDoc.name,
  description: groupDoc.description,
  admin: groupDoc.admin,
  members: groupDoc.members,
  createdAt: groupDoc.createdAt,
  updatedAt: groupDoc.updatedAt
});

const toUniqueStrings = (values = []) => [...new Set((values || []).map((v) => String(v)))];

const sendPrivateMessage = async (req, res) => {
  const { recipientId, content, messageType } = req.body;
  const message = await Message.create({
    sender: req.user.id,
    recipient: recipientId,
    content,
    messageType
  });

  return res.status(StatusCodes.CREATED).json(message);
};

const getPrivateMessages = async (req, res) => {
  const { userId } = req.params;
  const me = String(req.user.id);
  const messages = await Message.find({
    group: null,
    $or: [
      { sender: me, recipient: userId },
      { sender: userId, recipient: me }
    ]
  })
    .sort({ createdAt: 1 })
    .lean();

  return res.status(StatusCodes.OK).json(messages);
};

const createGroup = async (req, res) => {
  const { name, description, memberIds } = req.body;
  const uniqueMembers = toUniqueStrings([req.user.id, ...(memberIds || [])]);

  const group = await Group.create({
    name,
    description,
    admin: req.user.id,
    members: uniqueMembers
  });

  const groupData = toGroupResponse(group);
  const io = req.app.get('io');
  const adminId = String(req.user.id);
  const invitedMemberIds = uniqueMembers.filter((id) => id !== adminId);

  if (io) {
    uniqueMembers.forEach((memberId) => {
      io.in(`user:${memberId}`).socketsJoin(`group:${group._id}`);
    });

    invitedMemberIds.forEach((memberId) => {
      io.to(`user:${memberId}`).emit('group:added', {
        group: groupData,
        addedBy: adminId
      });
    });
  }

  return res.status(StatusCodes.CREATED).json(groupData);
};

const addGroupMembers = async (req, res) => {
  const { groupId, memberIds } = req.body;
  const uniqueRequestedMembers = toUniqueStrings(memberIds);

  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Group not found' });
  }

  if (String(group.admin) !== String(req.user.id)) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'Only group admin can add members' });
  }

  const existingMemberSet = new Set(group.members.map((m) => String(m)));
  const newMembers = uniqueRequestedMembers.filter((id) => !existingMemberSet.has(String(id)));

  if (newMembers.length === 0) {
    return res.status(StatusCodes.OK).json({
      group: toGroupResponse(group),
      addedMemberIds: []
    });
  }

  group.members = toUniqueStrings([...group.members.map(String), ...newMembers]);
  await group.save();

  const io = req.app.get('io');
  const groupData = toGroupResponse(group);
  if (io) {
    group.members.forEach((memberId) => {
      io.in(`user:${memberId}`).socketsJoin(`group:${group._id}`);
    });

    newMembers.forEach((memberId) => {
      io.to(`user:${memberId}`).emit('group:added', {
        group: groupData,
        addedBy: String(req.user.id)
      });
    });

    group.members.forEach((memberId) => {
      io.to(`user:${memberId}`).emit('group:members:added', {
        groupId: String(group._id),
        addedBy: String(req.user.id),
        addedMemberIds: newMembers
      });
    });
  }

  return res.status(StatusCodes.OK).json({
    group: groupData,
    addedMemberIds: newMembers
  });
};

const sendGroupMessage = async (req, res) => {
  const { groupId, content, messageType } = req.body;
  const group = await Group.findById(groupId).lean();

  if (!group || !group.members.some((m) => String(m) === String(req.user.id))) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'You are not a member of this group' });
  }

  const message = await Message.create({
    sender: req.user.id,
    group: groupId,
    content,
    messageType
  });

  return res.status(StatusCodes.CREATED).json(message);
};

const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  const group = await Group.findById(groupId).lean();

  if (!group || !group.members.some((m) => String(m) === String(req.user.id))) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'You are not a member of this group' });
  }

  const messages = await Message.find({ group: groupId }).sort({ createdAt: 1 }).lean();
  return res.status(StatusCodes.OK).json(messages);
};

const listMyGroups = async (req, res) => {
  const groups = await Group.find({ members: req.user.id }).sort({ updatedAt: -1 }).lean();
  return res.status(StatusCodes.OK).json(
    groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      admin: g.admin,
      members: g.members,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt
    }))
  );
};

module.exports = {
  sendPrivateMessage,
  getPrivateMessages,
  createGroup,
  addGroupMembers,
  sendGroupMessage,
  getGroupMessages,
  listMyGroups
};
