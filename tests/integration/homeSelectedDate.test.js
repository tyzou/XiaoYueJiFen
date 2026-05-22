import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import mysql from 'mysql2/promise';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';

const TEST_DB_NAME = `xiaoyue_jifen_home_date_test_${process.pid}`;
process.env.MYSQL_DATABASE = TEST_DB_NAME;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { initializeDatabase, getPool } = require('../../src/db');
const { attachLocals } = require('../../src/middleware');
const pageRoutes = require('../../src/routes/pages');
const { getCurrentScore, listEnabledQuickItems } = require('../../src/services/scoreService');
const { db: dbConfig } = require('../../src/config');
const { getRecentDays, getServerToday, formatYmd } = require('../../src/utils/dateUtils');

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
      secret: 'home-selected-date-test',
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

async function getLatestTransactionDate() {
  const [rows] = await getPool().query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d
       FROM score_transactions
      ORDER BY id DESC
      LIMIT 1`
  );
  return rows[0]?.d;
}

async function getTransactionCount() {
  const [rows] = await getPool().query('SELECT COUNT(*) AS count FROM score_transactions');
  return Number(rows[0].count);
}

describe('home selectedDate integration', () => {
  let app;
  let quickItems;

  beforeAll(async () => {
    await dropTestDatabase();
    await initializeDatabase();
    app = createTestApp();
    quickItems = await listEnabledQuickItems();
    expect(quickItems.length).toBeGreaterThan(0);
  }, 60000);

  afterAll(async () => {
    try {
      await getPool().end();
    } catch (_) {
      // ignore
    }
    await dropTestDatabase();
  }, 60000);

  beforeEach(async () => {
    await getPool().query(
      "UPDATE settings SET `value` = '0' WHERE `key` = 'current_score'"
    );
    await getPool().query('TRUNCATE TABLE score_transactions');
  });

  it('首页渲染最近 3 天日期选项，默认选中今天', async () => {
    const recentDays = getRecentDays();

    const res = await request(app).get('/').expect(200);

    for (const day of recentDays) {
      expect(res.text).toContain(`value="${day.value}"`);
      expect(res.text).toContain(day.label);
    }
    expect(res.text.match(/name="scoreDateSelection"/g)).toHaveLength(3);
    expect(res.text).toContain(`value="${recentDays[0].value}" checked`);
    expect(res.text).toContain('data-selected-date-field');
    expect(res.text).toContain('data-today-score-value');
  });

  it('首页当前总积分卡片展示今日快捷和手动净积分，不包含非今日记录', async () => {
    const yesterday = getRecentDays()[1].value;

    await request(app)
      .post('/score/manual')
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({ pointsDelta: 6, reason: 'today score test' })
      .expect(200);

    await request(app)
      .post(`/score/quick/${quickItems[0].id}`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({ selectedDate: yesterday })
      .expect(200);

    const res = await request(app).get('/').expect(200);

    expect(res.text).toContain('今日积分');
    expect(res.text).toMatch(/data-today-score-value>\+6<\/strong>/);
  });

  it('快捷操作提交昨天时，流水日期等于所选日期', async () => {
    const selectedDate = getRecentDays()[1].value;

    await request(app)
      .post(`/score/quick/${quickItems[0].id}`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({ selectedDate })
      .expect(200);

    expect(await getLatestTransactionDate()).toBe(selectedDate);
  });

  it('手动记录提交前天时，流水日期等于所选日期', async () => {
    const selectedDate = getRecentDays()[2].value;

    await request(app)
      .post('/score/manual')
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({ pointsDelta: 7, reason: '集成测试', selectedDate })
      .expect(200);

    expect(await getLatestTransactionDate()).toBe(selectedDate);
  });

  it('快捷和手动操作拒绝非法 selectedDate，且不改变积分或流水', async () => {
    const invalidDates = ['not-a-date', formatYmd(new Date(2000, 0, 1))];

    for (const invalidDate of invalidDates) {
      const scoreBefore = await getCurrentScore();
      const countBefore = await getTransactionCount();

      await request(app)
        .post(`/score/quick/${quickItems[0].id}`)
        .set('Accept', 'application/json')
        .set('X-Requested-With', 'XMLHttpRequest')
        .type('form')
        .send({ selectedDate: invalidDate })
        .expect(400);

      expect(await getCurrentScore()).toBe(scoreBefore);
      expect(await getTransactionCount()).toBe(countBefore);

      await request(app)
        .post('/score/manual')
        .set('Accept', 'application/json')
        .set('X-Requested-With', 'XMLHttpRequest')
        .type('form')
        .send({ pointsDelta: 5, reason: '集成测试', selectedDate: invalidDate })
        .expect(400);

      expect(await getCurrentScore()).toBe(scoreBefore);
      expect(await getTransactionCount()).toBe(countBefore);
    }
  });

  it('设置总积分忽略 selectedDate，仍按当天写入流水', async () => {
    const selectedDate = getRecentDays()[2].value;
    const todayBefore = getServerToday(new Date());

    await request(app)
      .post('/score/adjust')
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({ targetScore: 88, reason: '集成测试校准', selectedDate })
      .expect(200);

    const todayAfter = getServerToday(new Date());
    expect([todayBefore, todayAfter]).toContain(await getLatestTransactionDate());
  });
});
