const env = process.env;

const config = {
  db: { /* exposed sensitive info done only for debugging/demo purposes */
    host: env.MYSQL_HOST || '127.0.0.1',
    user: env.MYSQL_USER || 'wagr',
    password: env.MYSQL_PASSWORD || 'challenge',
    database: env.MYSQL_DATABASE || 'bets',
  },
  listPerPage: env.LIST_PER_PAGE || 10,
};

module.exports = config;