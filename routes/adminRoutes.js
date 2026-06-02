const express = require('express');
const router = express.Router();
const { loginAdmin, signupAdmin } = require('../controllers/adminController');

router.post('/signup', signupAdmin);
router.post('/login', loginAdmin);

module.exports = router;