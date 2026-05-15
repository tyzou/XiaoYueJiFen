const mysql = require('mysql2/promise');
const { db } = require('./config');

let pool;

const defaultQuickItems = [
  ['主动写作业', 5, 'add', '✏️', 10],
  ['帮忙做家务', 3, 'add', '🧹', 20],
  ['按时睡觉', 2, 'add', '🌙', 30],
  ['认真阅读', 4, 'add', '📚', 40],
  ['发脾气', -3, 'subtract', '🌧️', 50],
  ['拖拉作业', -5, 'subtract', '🐌', 60],
  ['乱扔东西', -2, 'subtract', '🧸', 70]
];

async function createDatabaseIfNeeded() {
  const connection = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    multipleStatements: false
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function initializeDatabase() {
  await createDatabaseIfNeeded();

  pool = mysql.createPool({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quick_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      points INT NOT NULL,
      type ENUM('add', 'subtract') NOT NULL,
      icon VARCHAR(80),
      sort_order INT DEFAULT 0,
      enabled TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query('ALTER TABLE quick_items MODIFY icon VARCHAR(80)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS score_transactions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      type ENUM('add', 'subtract', 'adjust') NOT NULL,
      points_delta INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      source ENUM('quick', 'manual', 'adjust') NOT NULL,
      quick_item_id BIGINT NULL,
      balance_after INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_score_transactions_quick_item
        FOREIGN KEY (quick_item_id)
        REFERENCES quick_items(id)
        ON DELETE SET NULL
    )
  `);

  await pool.query(
    "INSERT INTO settings (`key`, `value`) VALUES ('current_score', '0') ON DUPLICATE KEY UPDATE `value` = `value`"
  );

  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM quick_items');
  if (rows[0].count === 0) {
    await pool.query(
      'INSERT INTO quick_items (name, points, type, icon, sort_order) VALUES ?',
      [defaultQuickItems]
    );
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database has not been initialized');
  }
  return pool;
}

async function withTransaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  withTransaction
};
