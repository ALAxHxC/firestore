var express = require('express');
var router = express.Router();
var user = require('../controller/user.controller');

router.post('/', user.validate_request_register, user.register_user_firestore);
router.get('/courses', user.list_courses);
router.get('/confirm/:token', user.validate_token_user);
router.post('/login', user.login_user);
router.post('/courses', user.enrolle_course);
router.delete('/courses/:email/:id', user.remove_course_enrolle);
router.get('/courses/:email', user.list_course_user);
module.exports = router;
