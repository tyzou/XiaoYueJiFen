const bcrypt = require('bcryptjs');
const express = require('express');
const { app } = require('../config');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/');
  }
  return res.render('login', { title: '登录' });
});

router.post('/login', async (req, res) => {
  const password = String(req.body.password || '');
  const configuredPassword = app.adminPassword;

  const isBcryptHash = configuredPassword.startsWith('$2a$') || configuredPassword.startsWith('$2b$');
  const isValid = isBcryptHash
    ? await bcrypt.compare(password, configuredPassword)
    : password === configuredPassword;

  if (!isValid) {
    req.flash('error', '管理密码不正确。');
    return res.redirect('/login');
  }

  req.session.regenerate((error) => {
    if (error) {
      req.flash('error', '登录状态创建失败，请重试。');
      return res.redirect('/login');
    }
    req.session.authenticated = true;
    req.session.csrfToken = undefined;
    req.flash('success', '已登录。');
    return res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
