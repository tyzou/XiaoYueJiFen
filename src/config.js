require('dotenv').config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  app: {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    sessionSecret: getRequiredEnv('SESSION_SECRET'),
    adminPassword: getRequiredEnv('ADMIN_PASSWORD')
  },
  db: {
    host: process.env.MYSQL_HOST || '192.168.1.100',
    port: Number(process.env.MYSQL_PORT || 13306),
    database: process.env.MYSQL_DATABASE || 'xiaoyue_jifen',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'mysql_aiRnhA'
  }
};
