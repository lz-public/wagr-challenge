/*
 * WAGR // Bet server - Challenge by LZ - 2021
 */

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { query, transaction } = require('./db/base');

/* Express + our core library */
const app = express();
const fn = require("./core/library");

/* Content parser middleware */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* routes */
require('./core/routes')(app);

/* Error handler middleware */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(err.message, err.stack);
  res.status(res.status ? res.status : statusCode).json({'message': err.message});
  return;
});

/* startup data reset */
async function init() {
  try {
    await fn.resetBetData();
    await fn.loadGamesData();
    await fn.loadUsersData();
  } catch(err) {
    throw new Error(err);
  }
  return true;
}

/* server init */
const port = process.env.NODEJS_LOCAL_PORT || 3000;
app.listen(port, async () => {
	console.log(`Worker: process ${process.pid} is up on port ${port}`);
  try {
    await init();
	  console.log(`DB models initialized.`);
  } catch (e) {
    throw e;
  }
});
