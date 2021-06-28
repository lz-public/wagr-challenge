const fetch = require("node-fetch");
const db = require('../db/base');

// lists all the games sorted by date
async function showGames() {
  try {
    let rows = await db.query('SELECT startDateTime, gameId, sport, homeTeamId, awayTeamId FROM games ORDER BY startDateTime');
    return rows;
  } catch (e) {
    throw new Error(e);
  }
}

// lists all the bets sorted by creation date
async function getAllBets() {
  try {
    let rows = await db.query(
      `SELECT b.betId, b.created, b.userA, b.userATeam, b.userB, b.userBTeam, b.amount, g.sport, g.startDateTime 
       FROM bets AS b LEFT JOIN games AS g ON b.gameId=g.gameId
       ORDER BY b.created;`
    );
    return rows;
  } catch (e) {
    throw new Error(e);
  }
}

// get the user's balance
async function getUserBalance(userId) {
  try {
    let userBalance = await db.query(`SELECT balance FROM users WHERE userId='${userId}';`);
    let actual = userBalance[0].balance;
    let userBets = await db.query(`SELECT SUM(amount) AS amountMatched FROM bets WHERE (userA='${userId}' OR userB='${userId}') AND userB<>'';`);
    let amountMatched = (userBets[0].amountMatched) ? userBets[0].amountMatched : 0;
    let userOrders = await db.query(`SELECT SUM(amount) AS amountPlaced FROM bets WHERE userA='${userId}' AND userB='';`);
    let amountPlaced = (userOrders[0].amountPlaced) ? userOrders[0].amountPlaced : 0;
    return { actual, amountMatched, amountPlaced };
  } catch (e) {
    throw new Error(e);
  }
}

// place a bet
async function createBet(req) {
  // validate input
  const userId = (req.body.userId && req.body.userId != '') ? req.body.userId : null;
  const gameId = (req.body.gameId && req.body.gameId != '') ? req.body.gameId : null;
  const isHomeTeam = (req.body.isHomeTeam && req.body.isHomeTeam == 'true') ? true : false;
  const amount = (req.body.amount && parseFloat(req.body.amount) > 0) ? parseFloat(req.body.amount) : 0;

  if (!userId || !gameId || amount <= 0) {
    return { status: 400, reason: "Invalid parameters" };
  }

  // check the balance
  let availableBalance = 0;
  try {
    let balanceInfo = await db.query(`SELECT balance FROM users WHERE userId='${userId}' AND balance>='${amount}'`);
    availableBalance = (balanceInfo[0] && balanceInfo[0].balance) ? balanceInfo[0].balance : 0;
    if (amount > availableBalance) {
      return { status: 401, reason: "Not enough balance to place the bet" };
    }
  } catch (e) {
    throw new Error(e);
  }

  // get the game info
  let homeTeamId = 0;
  let awayTeamId = 0;
  let betForTeamId = 0;
  let betAgainstTeamId = 0;
  try {
    let gameInfo = await db.query(`SELECT homeTeamId, awayTeamId FROM games WHERE gameId='${gameId}'`);
    if (gameInfo.length != 1 || !gameInfo[0].homeTeamId || !gameInfo[0].awayTeamId) {
      return { status: 500, reason: "Game info not available" };
    }
    homeTeamId = gameInfo[0].homeTeamId;
    awayTeamId = gameInfo[0].awayTeamId;
    betForTeamId = (isHomeTeam) ? gameInfo[0].homeTeamId : gameInfo[0].awayTeamId;
    betAgainstTeamId = (isHomeTeam) ? gameInfo[0].awayTeamId : gameInfo[0].homeTeamId;
  } catch (e) {
    throw new Error(e);
  }

  // place or match bets
  try {
    let betInfo = await db.query(`CALL getBet('${gameId}', '${userId}', '${betForTeamId}', '${betAgainstTeamId}', ${amount});`);
    if (betInfo.length != 2 || !betInfo[0] || !betInfo[0][0] || (!betInfo[0][0].betId && !betInfo[0][0].error)) {
      return { status: 500, reason: "The bet could not be placed", dataSets: betInfo.length, serverResponse: betInfo[0] };
    }
    if (betInfo[0][0].error) {
      return { status: 401, reason: betInfo[0][0].error };
    }
    let action = (betInfo[0][0].userB != "") ? "matched" : "placed";

    return {
      action,
      details: betInfo[0][0]
    };
  } catch (e) {
    throw new Error(e);
  }
}

// base loaders and initializers

async function loadGamesData() {
  let response = await fetch('https://us-central1-wagr-develop.cloudfunctions.net/code-challenge-games-data');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  let games = await response.json();
  const splitBaseProperties = game => {
    return '(' + [
        game.gameId, game.homeTeamId, game.awayTeamId, game.startDateTime,
        game.sport.toUpperCase(),
        JSON.stringify((({ gameId, homeTeamId, awayTeamId, startDateTime, sport, ...extraGameData }) => extraGameData)(game))
      ].map(s => `'${s}'`).join(',') + ')';
  };
  let formattedGamesData = games.map(g => splitBaseProperties(g)).join(',');
  let sqlCommands = [
    `DROP TABLE IF EXISTS games;`,
    `CREATE TABLE games (
      gameId bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
      homeTeamId bigint unsigned NOT NULL,
      awayTeamId bigint unsigned NOT NULL,
      startDateTime datetime NOT NULL ON UPDATE CURRENT_TIMESTAMP,
      sport varchar(100) COLLATE 'utf8mb4_bin' NOT NULL,
      gameInfo json NOT NULL
    ) ENGINE='InnoDB' COLLATE 'utf8mb4_bin';`,
    `ALTER TABLE games
      ADD INDEX startDateTime (startDateTime),
      ADD INDEX homeTeamId_awayTeamId_sport (homeTeamId, awayTeamId, sport),
      ADD INDEX sport (sport);`,
    `INSERT INTO games (gameId, homeTeamId, awayTeamId, startDateTime, sport, gameInfo) VALUES ` + formattedGamesData
  ];
  let rows = await db.transaction(sqlCommands);
  return rows;
}

async function loadUsersData() {
  let response = await fetch('https://us-central1-wagr-develop.cloudfunctions.net/code-challenge-users-data');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  let users = await response.json();
  const splitBaseProperties = user => {
    return '(' + [user.userId, user.firstName, user.lastName, user.username, user.balance].map(s => `'${s}'`).join(',') + ')';
  };
  let formattedUsersData = users.map(u => splitBaseProperties(u)).join(',');
  let sqlCommands = [
    `DROP TABLE IF EXISTS users;`,
    `CREATE TABLE users (
      userId varchar(50) NOT NULL PRIMARY KEY,
      firstName varchar(50) NOT NULL,
      lastName varchar(50) NOT NULL,
      username varchar(50) NOT NULL,
      balance decimal(6,2)  NOT NULL
    ) ENGINE='InnoDB' COLLATE 'utf8mb4_bin';`,
    `ALTER TABLE users ADD UNIQUE username (username);`,
    `INSERT INTO users (userId, firstName, lastName, username, balance) VALUES ` + formattedUsersData
  ];
  let rows = await db.transaction(sqlCommands);
  return rows;
}

async function resetBetData() {
  let sqlCommands = [
    `DROP TABLE IF EXISTS bets;`,
    `CREATE TABLE bets (
      betId bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userA varchar(50) NOT NULL,
      userATeam bigint unsigned NOT NULL,
      userB varchar(50) NOT NULL,
      userBTeam bigint unsigned NOT NULL,
      gameId bigint unsigned NOT NULL,
      created datetime NOT NULL ON UPDATE CURRENT_TIMESTAMP,
      amount decimal(6,2)  NOT NULL
    ) ENGINE='InnoDB' COLLATE 'utf8mb4_bin';`,
    `ALTER TABLE bets
      ADD INDEX gameId (gameId),
      ADD INDEX created (created);`
  ];
  let rows = await db.transaction(sqlCommands);  
  return rows;
}

async function createDbFunctions() {
  await db.query(`DROP PROCEDURE IF EXISTS getBet;`),
  await db.query(`CREATE PROCEDURE getBet(
    IN gameId BIGINT,
    IN betUserId VARCHAR(50),
    IN betForTeamId BIGINT,
    IN betAgainstTeamId BIGINT,
    IN betAmount DECIMAL(6,2)
)
BEGIN   
    SELECT balance INTO @usersBalance FROM users WHERE userId=betUserId AND balance-betAmount>=0;
    IF @usersBalance IS NOT NULL AND @usersBalance >= 0
    THEN
        START TRANSACTION;
        SELECT betId INTO @betId
            FROM bets 
            WHERE gameId=gameId AND 
                  userB='' AND 
                  userA<>betUserId AND
                  userATeam=betAgainstTeamId AND
                  amount=betAmount
            LIMIT 1;
        IF @betId IS NOT NULL AND @betId > 0
        THEN
            UPDATE bets
            SET userB=betUserId,
                userBTeam=betForTeamId
            WHERE betId=@betId 
            LIMIT 1;
        ELSE
            INSERT INTO bets (userA, userATeam, userB, userBTeam, gameId, created, amount)
            VALUES(betUserId, betForTeamId, '', '0', gameId, NOW(), betAmount);
            SELECT LAST_INSERT_ID() INTO @betId;
        END IF;
        UPDATE users SET balance=balance-betAmount WHERE userId=betUserId;
        COMMIT;
        SELECT * from bets WHERE betId=@betId;
    ELSE
        SELECT 'INSUFFICIENT_BALANCE' AS error;
    END IF;
END;`);
}

module.exports = {
  showGames,
  getAllBets,
  getUserBalance,
  createBet,
  loadGamesData,
  loadUsersData,
  resetBetData,
  createDbFunctions
};