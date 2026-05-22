import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import mysql from 'mysql2/promise';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';

const TEST_DB_NAME = `xiaoyue_jifen_quick_layout_test_${process.pid}`;
process.env.MYSQL_DATABASE = TEST_DB_NAME;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { initializeDatabase, getPool } = require('../../src/db');
const { attachLocals } = require('../../src/middleware');
const pageRoutes = require('../../src/routes/pages');
const { db: dbConfig } = require('../../src/config');
const styles = fs.readFileSync(path.join(__dirname, '../../public/styles.css'), 'utf8');

async function dropTestDatabase() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  } finally {
    await conn.end();
  }
}

function createTestApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../../src/views'));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: 'quick-items-layout-test',
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

describe('quick items management layout', () => {
  beforeAll(async () => {
    await dropTestDatabase();
    await initializeDatabase();
  }, 60000);

  afterAll(async () => {
    try {
      await getPool().end();
    } catch (_) {
      // ignore
    }
    await dropTestDatabase();
  }, 60000);

  it('renders item actions inside compact more menus', async () => {
    const res = await request(createTestApp()).get('/quick-items').expect(200);

    expect(res.text).toContain('class="item-more-menu"');
    expect(res.text).toContain('class="item-more-actions"');
    expect(res.text).toContain('aria-label="更多操作"');
    expect(res.text).not.toContain('class="item-action-buttons"');
  });

  it('positions more menu to the left of the trigger with elevated row z-index', () => {
    expect(styles).toContain('.item-editor:has(.item-more-menu[open])');
    expect(styles).toContain('right: calc(100% + 8px)');
    expect(styles).toContain('transform: translateY(-50%)');
  });
});
