import { describe, it, expect } from 'vitest';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { attachLocals } = require('../../src/middleware');
const pageRoutes = require('../../src/routes/pages');

function createTestApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../../src/views'));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: 'settings-page-test',
      resave: false,
      saveUninitialized: true
    })
  );
  app.use(flash());
  app.use((req, _res, next) => {
    req.session.authenticated = true;
    next();
  });
  app.use(attachLocals);
  app.use(pageRoutes);
  return app;
}

describe('settings page', () => {
  it('渲染菜单式设置页，包含设置导航、关于我和退出登录', async () => {
    const res = await request(createTestApp()).get('/settings').expect(200);

    expect(res.text).toContain('<title>设置</title>');
    expect(res.text).toContain('小月积分屋');
    expect(res.text).toContain('关于我');
    expect(res.text).toContain('退出登录');
    expect(res.text).toContain('action="/logout"');
    expect(res.text).toContain('href="/settings"');
    expect(res.text).toContain('设置</span>');
    expect(res.text).toContain('快捷项管理');
    expect(res.text).toContain('积分流水');
  });
});
