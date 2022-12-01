const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length <= 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}',
          '${name}', 
          '${gender}'
        )`;
      const dbResponse = await database.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    username: dbObject.username,
    name: dbObject.name,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);

  const tweetsQuery = `
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime FROM user INNER JOIN tweet 
    ON user.user_id=tweet.user_id INNER JOIN follower 
    ON tweet.user_id=follower.following_user_id
     WHERE follower_user_id='${userDetails.user_id}'
    ORDER BY date_time DESC
     LIMIT 4`;
  const feed = await database.all(tweetsQuery);
  response.send(feed);
});
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);

  const followingQuery = `
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
     WHERE follower_user_id='${userDetails.user_id}'`;
  const following = await database.all(followingQuery);
  response.send(following);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);

  const followersQuery = `
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
   WHERE following_user_id='${userDetails.user_id}'`;
  const followers = await database.all(followersQuery);
  response.send(followers);
});
/*const convertTweetsObjectToResponseObject=(dbObject)=>{
    return{
        tweet:dbObject.tweet,
        likes:dbObject.likes,
        replies:dbObject.replies,
        dateTime:dbObject.date_time
    }
}*/

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  let { username } = request;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);

  const tweetQuery = `
   SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
  const tweetResult = await database.get(tweetQuery);

  const followingQuery = `
    SELECT * FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
      WHERE follower.follower_user_id='${userDetails.user_id}' `;
  const following = await database.all(followingQuery);

  if (
    following.some((each) => each.following_user_id === tweetResult.user_id)
  ) {
    const { tweet_id, date_time, tweet } = tweetResult;
    const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;`; //Getting likes of the tweet
    const likesObject = await database.get(getLikesQuery);
    const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;`; //getting replies of the tweet
    const repliesObject = await database.get(getRepliesQuery);
    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
convertDbObjectToResponse = (dbObject) => {
  return {
    name: dbObject.username,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    let { username } = request;

    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await database.get(selectUserQuery);

    const tweetQuery = `
   SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
    const tweetResult = await database.get(tweetQuery);

    const followingQuery = `
    SELECT * FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
      WHERE follower.follower_user_id='${userDetails.user_id}' `;
    const following = await database.all(followingQuery);

    if (
      following.some((each) => each.following_user_id === tweetResult.user_id)
    ) {
      const getLikesQuery = `
    SELECT username FROM user NATURAL JOIN like 
    WHERE tweet_id = '${tweetId}' GROUP BY like_id;`;
      const likesObject = await database.all(getLikesQuery);
      response.send({ likes: likesObject.map((each) => each.username) });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get("/tweets/:tweetId/replies/",authenticateToken,async(request,response)=>{
     const { tweetId } = request.params;

    let { username } = request;

    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await database.get(selectUserQuery);

    const tweetQuery = `
   SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
    const tweetResult = await database.get(tweetQuery);

    const followingQuery = `
    SELECT * FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
      WHERE follower.follower_user_id='${userDetails.user_id}' `;
    const following = await database.all(followingQuery);

    if (
      following.some((each) => each.following_user_id === tweetResult.user_id)
    ) {
const repliesQuery=`
SELECT name,reply FROM user NATURAL JOIN reply
WHERE tweet_id='${tweetId}' GROUP BY reply_id`
const repliesObject= await database.all(repliesQuery)
response.send({
    replies:repliesObject.map((each)=>({name:each.name,
        reply:each.reply}))
})

    }else{
       response.status(401);
      response.send("Invalid Request");
        }
})
app.get("/user/tweets/",authenticateToken,async(request,response)=>{
 let { username } = request;

    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await database.get(selectUserQuery);
    
    const tweetQuery=`
    SELECT tweet,(SELECT COUNT(like_id) FROM like WHERE tweet_id=tweet.tweet_id ) AS likes,(SELECT COUNT(reply_id) FROM reply WHERE tweet_id=tweet.tweet_id) AS replies, date_time AS dateTime FROM tweet
   
    WHERE user_id='${userDetails.user_id}'`
    const  tweetsList= await database.all(tweetQuery)
    response.send(tweetsList.map((each)=>({tweet:each.tweet,likes:each.likes,replies:each.replies,dateTime:each.dateTime})))
   
})

app.post("/user/tweets/",authenticateToken,async(request,response)=>{
  let { username } = request;

    const selectUserQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
    const dbUser = await database.get(selectUserQuery);
    const {user_id}=dbUser
    const {tweet} = request.body
    const date_time=new Date()
    
    const postQuery=`
    INSERT INTO tweet (tweet,user_id,date_time) VALUES ('${tweet}',${user_id},'${date_time}')`
    await database.run(postQuery)
    response.send("Created a Tweet")
})

app.delete("/tweets/:tweetId/",authenticateToken,async(request,response)=>{
  const { tweetId } = request.params;

    let { username } = request;

    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const userDetails = await database.get(selectUserQuery);

    const tweetQuery = `
   SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
    const tweetResult = await database.get(tweetQuery);
  
    if ( userDetails.user_id === tweetResult.user_id) {

const deleteQuery=`DELETE FROM tweet WHERE tweet_id='${tweetId}'`
 await database.run(deleteQuery)
response.send("Tweet Removed")
     }else{
       response.status(401);
      response.send("Invalid Request");
        }

})

module.exports = app;