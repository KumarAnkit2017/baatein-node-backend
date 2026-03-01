const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getMe, updateMe, listUsers } = require('../controllers/userController');
const { profileSchema } = require('../utils/validators');

const router = express.Router();

router.use(auth);
router.get('/me', getMe);
router.patch('/me', validate(profileSchema), updateMe);
router.get('/', listUsers);

module.exports = router;