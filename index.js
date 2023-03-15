import express from "express";
import helmet from "helmet";
import userInfoRouter from "./routes/user-info.js";
import accountInfoRouter from "./routes/account-info.js";
import transferRouter from "./routes/transfer.js";
import testingRouter from "./routes/testing.js";
import { DB_USERNAME, DB_PASSWORD, PORT, RESPONSE } from "./utils.js";
import { initializeMongoDB } from "./mongodb.js";

/*
api/
├─ user-info/
├─ transfer/
├─ account-info/
*/
console.log("Starting server");

await initializeMongoDB(DB_USERNAME, DB_PASSWORD);

const app = express();

// http packet body should be in json format
app.use(express.json({ limit: '50mb' }));

// security checks
app.use(helmet());

app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ["*"]);
    res.append("Access-Control-Allow-Methods", "GET,POST,DELETE,PUT");
    res.append("Access-Control-Allow-Headers", "Content-Type");
    return next();
});

app.get(
    '/api',
    (req, res, next) => {
        res.status(RESPONSE.OK).send("Welcome to the AI Bank Of Forever APIs!");
        return next();
    }
);

app.use('/api/user-info', userInfoRouter);
app.use('/api/transfer', transferRouter);
app.use('/api/account-info', accountInfoRouter);
app.use('/api/testing', testingRouter);

console.log("Routers set.");

app.listen(
    PORT,
    () => console.log(`Listening on port ${PORT}.`)
);
