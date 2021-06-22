# wagr-challenge
## Sport Bets Server

We want to build a betting engine to allow users to create open bets and automatically match them with other users who take the other side of the bet.

## How to run the example

With  Docker installed yu can run the example with:

```
docker compose build
docker compose up
```

To shut the server down use Ctr+C or:
```
docker compose down
```

To restart the app only keep (mysql running):
```
docker compose --build app
```

> Note: On some systems that have docker/mysql volumes, the user may not be set up properly and you'll need to follow the troubleshooting instructions at the bottom of this document. 

Once the server started, you can follow the endpoints documented in the following live --> [Postman collection](https://documenter.getpostman.com/view/11980407/Tzeah5gV) <--, or install the collection to your Postman, available at https://github.com/lz-public/wagr-challenge/blob/main/wagr-challenge-postman.json

Additionally, if you want to see what's happening in the databaase, you can use a small portable tool called Adminer:

```
docker pull adminer;  
docker run --link wagr-challenge_mysqldb_1:mysqldb --net wagr-challenge_default -p 8080:8080 adminer
```
Open your broser at http://localhost:8080/?server=mysqldb and enter the following login info: *user: wagr* / *pass: challenge*

## How it works
This engine loads games and user data from external endpoints, into into a relational database (MySQL). As some of the games data is unstructured, the base field are stored in the database aas columns, while the unstructured data is stored in a json-type column. This helps us to keep the power of relational databases and the flexibility of document databases. For this example, the unstructured data is loaded but not used at all (maybe in the future we want to show more info abut the games).

There's also a *bet* table to store the bets placed by the users. The main endpoint is the one used to create a bet. When a user places a bet the column userA is allways completed and the column userB is empty. This means that when a row contains a value in userA but an empty value in userB, the bet has been placed but not matched with any other user's bet.

When a user places a bet that matches any existing *placed* bet, this is, different user, same amount, same game and the opposite team, the userB column is filled. That way, any row that contains non-empty values in the columns userA and userB shows us that there's a matching bet between users.

All the data is completely initialized each time the server is started. Once the data is loaded, all endpoints are available for consumption. 

## Business rules (requirement)
This server covers the following busines rules:
1. A user should be able to place a bet on a game by choosing a specific team. Store this in the database.  
2. If there's a bet on the same game - same dollar amount, but the opposing team is chosen - the database should reflect that *the two users are matched for that bet.*  
3. When a user places a bet (regardless of if they are matched or not), their balance needs to decrease by the bet amount. The create bet process should be highly transactional so that if one step in the process fails, all database changes should be rolled back.

## See it in action
The Postman collection contains all the steps in order, so that you can watch step-by-step how the information in the database changes. The containers log will show you the SQL queries that are being executed.

## Assumptions
1. A user can place any number of bets for the same game, team and amount, while he has available balance. The bets will be matched with other user's bets.
2. A unfulfilled bet blocks the user's balance. There's no way (in the current version) to recover that balance.

## Technical notes
The way the database transactions are executed expects to handle technical failures only, not concurreny. A better (production) approach would be to create bets in a stored procedure, where the balance is decreased, a free betId is found  and the insert/update action is donein an atomic transaction. 
> The current code needs a fix. The SQL command that gets the betId should run inside the transaction.

## Endpoints


### Return list of all games ordered by game start time
GET http://localhost:3000/games

### Create bet
POST http://localhost:3000/bets
BODY

```
{
    "userId": "{userId}",
    "isHomeTeam": "true", // or "false" for the away team
    "amount": decimal number,
    "gameId": {gameId}
}
```

### Return list of all bets ordered by created date
GET http://localhost:3000/bets

### Return a user's balance information
GET http://localhost:3000/user/{userId}/balance


## Troubleshoting
If you experience any issues running this code, maybe it's because you already have a previous mysql installation mounted on a Docker volume and docker-compose doesn't spin up the new user/db on that mysql installation.

To solve it:
1. Start the services with:
```
docker compose up
docker pull adminer;  
docker run --link wagr-challenge_mysqldb_1:mysqldb --net wagr-challenge_default -p 8080:8080 adminer
```
2. Open in your browser: http://localhost:8080/?server=mysqldb&username=root&db=mysql&select=db and log in with user *root* and password *r00t*
3. With the prevoius link you should be viewing the `db` table inside the `mysql` database. You will see the core databases there. Clone a row and change the column data to:
```
Host: %
Db: bets
User: wagr
(all other privileges set to Y)
```
4. Shut the app down with `Ctrl+C`, and restart. You shouldn't see any mysql-related errors. Case else, please contact me.


