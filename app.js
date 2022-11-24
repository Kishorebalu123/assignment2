
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
  const { username, password, name, gender} = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
   if(password.length<=6){
    response.status(400)
    response.send("Password is too short")
   }else{ const createUserQuery = `
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
  }} else {
    response.status (400);
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
const convertDbObjectToResponseObject=(dbObject)=>{
    return{
         username:dbObject.username,
        name:dbObject.name,
        tweet:dbObject.tweet,
        dateTime:dbObject.date_time
    }
}

app.get("/user/tweets/feed/",authenticateToken,async(request,response)=>{
   let {username}=request
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await database.get(selectUserQuery);
  
   const tweetsQuery=`
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime FROM user INNER JOIN tweet 
    ON user.user_id=tweet.user_id INNER JOIN follower 
    ON tweet.user_id=follower.following_user_id
     WHERE follower_user_id='${userDetails.user_id}'
    ORDER BY date_time DESC
     LIMIT 4`
    const feed=await database.all(tweetsQuery)
    response.send(feed)

})
app.get("/user/following/",authenticateToken,async(request,response)=>{
    let {username}=request
   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
   const userDetails = await database.get(selectUserQuery);
  
    const followingQuery=`
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
     WHERE follower_user_id='${userDetails.user_id}'`
    const following = await database.all(followingQuery)
    response.send(following)
})
app.get("/user/followers/",authenticateToken,async(request,response)=>{
   let {username}=request
   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
   const userDetails = await database.get(selectUserQuery);
   
    const followersQuery=`
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
   WHERE following_user_id='${userDetails.user_id}'`
    const followers = await database.all(followersQuery)
    response.send(followers)
    
})
/*const convertTweetsObjectToResponseObject=(dbObject)=>{
    return{
        tweet:dbObject.tweet,
        likes:dbObject.likes,
        replies:dbObject.replies,
        dateTime:dbObject.date_time
    }
}*/
app.get("/tweets/:tweetId/",authenticateToken, async(request,response)=>{
    const {tweetId}=request.params
 
  let {username}=request
   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
   const userDetails = await database.get(selectUserQuery);
 
   const tweetQuery=`
   SELECT * FROM tweet WHERE tweet_id='${tweetId}'` 
   const tweet= await database.get(tweetQuery)
   
   const followingQuery=`
    SELECT * FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
      WHERE follower.follower_user_id='${userDetails.user_id}' `
    const following = await database.all(followingQuery)
   //console.log(following)
  //console.log(tweet.user_id)
  if(following.some((each)=>each.following_user_id===tweet.user_id)){

const getTweetsQuery=`
    SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies,date_time AS dateTime FROM  like INNER JOIN reply
    ON like.user_id=reply.user_id INNER JOIN tweet ON reply.user_id=tweet.user_id INNER JOIN follower
     ON tweet.user_id=follower.following_user_id
    WHERE follower.follower_user_id='${userDetails.user_id}'  `
    const tweets=await database.get(getTweetsQuery)
    response.send(tweets)
  }else{
      response.status(401)
      response.send("Invalid Request")
  }
})


module.exports=app