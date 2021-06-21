const fn = require("./library");

module.exports = app => {
  // health-check
  app.route('/').get(async (req, res) => {
    try {
      res.send({ serverStatus: "ok", date: (new Date()).toString() });
    } catch (e) {
      throw e;
    }
  });

  app.route('/games').get(async (req, res) => {
    try {
      res.send(await fn.showGames());
    } catch (e) {
      throw e;
    }
  });

  app.route('/bets').post(async (req, res) => {
    try {
      res.send(await fn.createBet(req));
    } catch (e) {
      throw e;
    }
  });

  app.route('/bets').get(async (req, res) => {
    try {
      res.send(await fn.getAllBets(['created']));
    } catch (e) {
      throw e;
    }
  });

  app.route('/user/:userId/balance').get(async (req, res) => {
    if (!req.params.userId) {
      res.send({ "status": "404", "reason": "User not found" });
      return;
    }
    try {
      res.send(await fn.getUserBalance(req.params.userId));
    } catch (e) {
      throw e;
    }
  });
};
