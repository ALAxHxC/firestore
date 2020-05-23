const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const axios = require('axios')
let db = admin.firestore();

const required_fields = [
  'first_name',
  'last_name',
  'email',
  'password',
  'dob'

]
const additional_fields = [
  'username',
  'gender'

]

//list courses
exports.list_courses = async (req, res, next) => {
  try {
    let data = await axios.get(process.env.URL_COURSES);
    return res.status(200).json(data.data)
  } catch (error) {
    return res.status(500).json({
      message: error.stack,
      stack: error.stack
    })
  }
}

//enrole curse

exports.enrolle_course = async (req, res, next) => {
  try {
    let data = await axios.get(process.env.URL_COURSES);
    let flag = null;
    data.data.forEach(item => {
      if (item.id == req.body.id) {
        flag = item;
      }
    })
    if (flag == null) {
      return res.status(400).json({
        message: 'Course Not Found'
      })
    }
    let user = await search_user(req.body.email);
    if (!user) {
      return res.status(403).json({
        message: 'User not found'
      })
    }
    if (user.confirm == false) {
      return res.status(403).json({
        message: 'Account not confirmed'
      })
    }
    let courses = await search_user_courses(req.body.email);

    courses[flag.id] = {
      course_name: flag.id,
      student_id: req.body.email,
      date: new Date().toISOString()
    }
    await update_user_courses(req.body.email, courses)
    return res.status(201).json({
      "status": "SUCCESS",
      "message": "Registration succesfull."
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      stack: error.stack
    })
  }
}

exports.remove_course_enrolle = async (req, res) => {
  let courses = await search_user_courses(req.params.email);
  delete courses[req.params.id]
  await update_user_courses(req.params.email, courses)

  return res.status(201).json({
    "status": "SUCCESS",
    "message": "Unregistration succesfull."
  })
}

exports.list_course_user = async (req, res) => {
  let courses = await search_user_courses(req.params.email);

  return res.status(201).json({
    "status": "SUCCESS",
    "courses": Object.values(courses)
  })
}



//middleware validate body
exports.validate_request_register = (req, res, next) => {

  required_fields.forEach(key => {
    if (!req.body[key]) {
      res.status(400).json({
        message: 'Miss field: ' + key
      });
      throw ('Error validaton')
    }

  })

  if (!validate_email(req.body.email)) {
    return res.status(400).json({
      message: 'Check email'
    })
  }
  return next();
}

//user login

exports.login_user = async (req, res) => {
  try {

    let user = await search_user(req.body.email);
    let password = jwt.decode(user.password);
    if (!user) {
      return res.status(403).json({
        message: 'User not found'
      })
    }
    if (user.confirm == false) {
      return res.status(403).json({
        message: 'Account not confirmed'
      })
    }
    if (req.body.password == password.password) {
      delete user.password;
      return res.status(200).json({
        "status": "SUCCESS",
        "user": user
      })
    }
    return res.status(403).json({
      message: 'BAD PASSWORD'
    })


  } catch (error) {
    return res.status(500).json({
      message: error.stack,
      stack: error.stack
    })
  }
}

//user validate

exports.validate_token_user = async (req, res) => {
  try {
    let token = req.params.token
    token = jwt.decode(token)
    let user = await search_user(token.email)
    if (!user) {
      return res.status(400).json({
        message: 'Validate Fail'
      })
    }
    user.confirm = true;
    let user_updated = db.collection('users').doc(user.email);

    await user_updated.set(user);

    return res.status(200).json({
      "status": "SUCCESS",
      "message": "Registration succesfull."
    })
  } catch (error) {
    return res.status(500).json({
      message: error.stack,
      stack: error.stack
    })
  }
}

//user register
exports.register_user_firestore = async (req, res) => {
  /*
  First Search user
  */
  try {
    let user = await search_user(req.body.email)
    if (user) {
      return res.status(400).json({
        message: 'User already exists'
      })
    }
    let password_token = jwt.sign({ password: req.body.password }, process.env.SECRET);
    let token = jwt.sign({ email: req.body.email }, process.env.SECRET);
    req.body.password = password_token
    req.body.confirm = false
    let new_user = db.collection('users').doc(req.body.email);

    let set_user = await new_user.set(req.body);
    await user_mail_validation(req.body.email, token)
    return res.status(201).json({
      "status": "SUCCESS",
      "message": `Verification token has been sent to ${req.body.email}.`,
    })
  } catch (error) {
    return res.status(500).json({
      message: error.stack,
      stack: error.stack
    })
  }

}
let search_user = async (email) => {
  try {
    let user = await db.collection('users').doc(email).get()
    return user.data()
  } catch (error) {
    console.error('Error in SEARCH_USER', error.message, error.stack)
    return null;
  }

}

let search_user_courses = async (email) => {
  try {
    let user = await db.collection('users_courses').doc(email).get()
    let data_courses = user.data()
    if (data_courses == undefined) { data_courses = {} }
    return data_courses
  } catch (error) {
    console.error('Error in SEARCH_USER', error.message, error.stack)
    return {};
  }
}

let update_user_courses = async (email, courses) => {
  let new_user = db.collection('users_courses').doc(email);
  let set_user = await new_user.set(courses);
}

let user_mail_validation = async (email, token) => {
  const msg = {
    to: email,
    from: process.env.FROM,
    subject: 'Confirm account',
    html: `<strong>and easy to do anywhere, even with Node.js http//:localhost:3000/users/confirm/${token}</strong>`,
  };
  await sgMail.send(msg);
}

let validate_email = (email) => {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

