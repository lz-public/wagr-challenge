const mysql = require('mysql2/promise');
const config = require('../config');

async function query(sql) {
  console.log(sql);
  // create the connection pool
  const pool = await mysql.createPool(config.db);
  const connection = await pool.getConnection();
  let result;
  try {
    result = await connection.query(sql);
  } catch (e) {
    throw new Error(e);
  }
  return result[0];
}

async function transaction(sqls) {
  console.log(sqls);
  // accept a single sql command or an array of commands
  if (!Array.isArray(sqls)) sqls = [sqls];

  // create the connection pool
  const pool = await mysql.createPool(config.db);
  const connection = await pool.getConnection();

  // prepare the output array for each executed command
  let results = [];

  // run all the queries in transactional mode
  try {
    // begin transaction
    await connection.query('START TRANSACTION');

    // execute each query sequentially and collect all the results
    const starterPromise = Promise.resolve(null);
    const log = result => results.push(result);
    await sqls.reduce(
        (p, singleSqlCommand) => p.then(() => connection.execute(singleSqlCommand).then(log)),
        starterPromise
    );

    // finish
    await connection.commit();
    await connection.release();
  } catch(e) {
    await connection.query('ROLLBACK');
    await connection.release();
    throw new Error(e);
  }
  return results;
}

module.exports = {
  query,
  transaction
}
