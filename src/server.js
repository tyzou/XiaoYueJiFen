const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const { app: appConfig } = require('./config');
const { initializeDatabase } = require('./db');
const { attachLocals, verifyCsrf } = require('./middleware');
const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    name: 'xiaoyue.sid',
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.nodeEnv === 'production' && process.env.FORCE_HTTPS === 'true',
      maxAge: 1000 * 60 * 60 * 24 * 365 * 10
    }
  })
);
app.use(flash());
app.use(attachLocals);
app.use(verifyCsrf);

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use(authRoutes);
app.use(pageRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    title: '页面不存在',
    message: '页面不存在。'
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('error', {
    title: '系统出错',
    message: '系统暂时出错，请稍后再试。'
  });
});

initializeDatabase()
  .then(() => {
    app.listen(appConfig.port, () => {
      console.log(`XiaoYue JiFen is running on port ${appConfig.port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
