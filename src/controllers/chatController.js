const { StatusCodes } = require('http-status-codes');
const Message = require('../models/Message');
const Group = require('../models/Group');

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
  const uniqueMembers = [...new Set([String(req.user.id), ...((memberIds || []).map(String))])];

  const group = await Group.create({
    name,
    description,
    admin: req.user.id,
    members: uniqueMembers
  });

  return res.status(StatusCodes.CREATED).json({
    _id: group._id,
    name: group.name,
    description: group.description,
    admin: group.admin,
    members: group.members,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
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
  sendGroupMessage,
  getGroupMessages,
  listMyGroups
};