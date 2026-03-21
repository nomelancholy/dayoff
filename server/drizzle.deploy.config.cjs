/** Docker/배포용: 마이그레이션만 실행 (schema 불필요) */
module.exports = {
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
