import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import mysql from 'mysql2/promise';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';

const TEST_DB_NAME = `xiaoyue_jifen_delete_test_${process.pid}`;
process.env.MYSQL_DATABASE = TEST_DB_NAME;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { initializeDatabase, getPool } = require('../../src/db');
const { attachLocals } = require('../../src/middleware');
const pageRoutes = require('../../src/routes/pages');
const {
  applyQuickItem,
  applyManualScore,
  adjustScore,
  getCurrentScore,
  listEnabledQuickItems
} = require('../../src/services/scoreService');
const { getRecentDays } = require('../../src/utils/dateUtils');
const { db: dbConfig } = require('../../src/config');

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
      secret: 'transaction-delete-test',
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

async function latestTransaction() {
  const [rows] = await getPool().query(
    'SELECT id, points_delta, source FROM score_transactions ORDER BY id DESC LIMIT 1'
  );
  return rows[0];
}

async function transactionCount() {
  const [rows] = await getPool().query('SELECT COUNT(*) AS count FROM score_transactions');
  return Number(rows[0].count);
}

describe('transaction delete integration', () => {
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

  it('deletes today quick add transaction and subtracts its points from current score', async () => {
    const quickItem = quickItems.find((item) => Number(item.points) > 0) || quickItems[0];
    await applyQuickItem(quickItem.id);
    const transaction = await latestTransaction();
    const scoreBefore = await getCurrentScore();

    const res = await request(app)
      .post(`/transactions/${transaction.id}/delete`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({})
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.currentScore).toBe(scoreBefore - Number(transaction.points_delta));
    expect(await getCurrentScore()).toBe(scoreBefore - Number(transaction.points_delta));
    expect(await transactionCount()).toBe(0);
  });

  it('deletes today manual subtract transaction and adds its points back to current score', async () => {
    await applyManualScore(-4, 'delete manual subtract');
    const transaction = await latestTransaction();

    const res = await request(app)
      .post(`/transactions/${transaction.id}/delete`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({})
      .expect(200);

    expect(res.body.currentScore).toBe(0);
    expect(await getCurrentScore()).toBe(0);
    expect(await transactionCount()).toBe(0);
  });

  it('rejects deleting non-today transactions without changing score or rows', async () => {
    await applyManualScore(5, 'yesterday transaction', {
      selectedDate: getRecentDays()[1].value
    });
    const transaction = await latestTransaction();

    await request(app)
      .post(`/transactions/${transaction.id}/delete`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({})
      .expect(400);

    expect(await getCurrentScore()).toBe(5);
    expect(await transactionCount()).toBe(1);
  });

  it('rejects deleting adjust transactions without changing score or rows', async () => {
    await adjustScore(88, 'adjust transaction');
    const transaction = await latestTransaction();

    await request(app)
      .post(`/transactions/${transaction.id}/delete`)
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({})
      .expect(400);

    expect(await getCurrentScore()).toBe(88);
    expect(await transactionCount()).toBe(1);
  });

  it('rejects deleting missing transactions', async () => {
    await request(app)
      .post('/transactions/999999/delete')
      .set('Accept', 'application/json')
      .set('X-Requested-With', 'XMLHttpRequest')
      .type('form')
      .send({})
      .expect(400);

    expect(await getCurrentScore()).toBe(0);
    expect(await transactionCount()).toBe(0);
  });

  it('renders delete data only for today quick or manual transactions', async () => {
    await applyManualScore(3, 'today manual');
    const todayManual = await latestTransaction();

    await applyManualScore(2, 'yesterday manual', {
      selectedDate: getRecentDays()[1].value
    });
    const yesterdayManual = await latestTransaction();

    await adjustScore(10, 'adjust today');
    const adjustTransaction = await latestTransaction();

    const res = await request(app).get('/transactions').expect(200);

    expect(res.text.match(/data-deletable-transaction/g)).toHaveLength(1);
    expect(res.text).toContain(`data-delete-url="/transactions/${todayManual.id}/delete"`);
    expect(res.text).not.toContain(`data-delete-url="/transactions/${yesterdayManual.id}/delete"`);
    expect(res.text).not.toContain(`data-delete-url="/transactions/${adjustTransaction.id}/delete"`);
  });
});
