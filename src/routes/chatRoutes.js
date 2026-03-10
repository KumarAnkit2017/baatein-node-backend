const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  sendPrivateMessage,
  getPrivateMessages,
  createGroup,
  addGroupMembers,
  sendGroupMessage,
  getGroupMessages,
  listMyGroups
} = require('../controllers/chatController');
const { privateMessageSchema, createGroupSchema, groupMessageSchema, addGroupMembersSchema } = require('../utils/validators');

const router = express.Router();
router.use(auth);

router.post('/private', validate(privateMessageSchema), sendPrivateMessage);
router.get('/private/:userId', getPrivateMessages);

router.post('/groups', validate(createGroupSchema), createGroup);
router.post('/groups/members', validate(addGroupMembersSchema), addGroupMembers);
router.get('/groups', listMyGroups);
router.post('/groups/message', validate(groupMessageSchema), sendGroupMessage);
router.get('/groups/:groupId/messages', getGroupMessages);

module.exports = router;
