const crypto = require('crypto');
const { isIconifyName, normalizeQuickIcon } = require('./icons');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderQuickIcon(icon, fallback, className = '') {
  const value = normalizeQuickIcon(icon || fallback);
  const classes = className ? ` class="${escapeHtml(className)}"` : '';

  if (isIconifyName(value)) {
    return `<iconify-icon${classes} icon="${escapeHtml(value)}" aria-hidden="true"></iconify-icon>`;
  }

  return `<span${classes}>${escapeHtml(value)}</span>`;
}

function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  return res.redirect('/login');
}

function attachLocals(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  res.locals.path = req.path;
  res.locals.isAuthenticated = Boolean(req.session.authenticated);
  res.locals.renderQuickIcon = renderQuickIcon;
  next();
}

function verifyCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  if (req.body && req.body._csrf === req.session.csrfToken) {
    return next();
  }

  req.flash('error', '页面已过期，请重新提交。');
  return res.redirect('back');
}

module.exports = {
  requireAuth,
  attachLocals,
  verifyCsrf
};
