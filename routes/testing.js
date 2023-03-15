import { RESPONSE, isValidEmailFormat, isValidMoneyAmount, parseUserRequestHistory, SECRET, generateError } from "../utils.js";
import { User, dbClient } from "../mongodb.js";
import express from "express";
import bcrypt from "bcrypt";


const router = express.Router();
const saltRounds = 12;
// used for testing purposes.
router.post(
    '/new-with-balance',
    async (req, res, next) => {
        const email = req.body.email;
        const password = req.body.password;
        const balance = req.body.balance;
        // check if parameters are valid
        if (!email || !isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid email.");
            return next();
        }
        // TODO: ask professor what password format he wants
        else if (!password) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid password.");
            return next();
        }
        else if (!isValidMoneyAmount(balance)) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid balance.");
            return next();
        }

        const session = await dbClient.startSession();
        await session.startTransaction();
        const newUser = {
            email: email,
            password: bcrypt.hashSync(password, saltRounds),
            balance: balance,
            moneyRequestHistory: []
        };
        try {
            const userExists = await User
                .findOne({ "email": email })
                .session(session);

            if (userExists) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.CONFLICT).send(`User account with email ${email} already exists.`);
                return next();
            }

            const newUserModel = new User(newUser);

            await newUserModel.save({ session });

            await session.commitTransaction();
            await session.endSession();


        } catch (error) {
            await session.abortTransaction();
            await session.endSession();
            res.status(RESPONSE.INTERNAL_SERVER_ERR).send(error);
            return next();
        }
        res.status(RESPONSE.CREATED).send(newUser);
        return next();
    }
);

// used for testing purposes.
router.post(
    '/new-with-history',
    async (req, res, next) => {
        const email = req.body.email;
        const password = req.body.password;
        const history = req.body.history;
        // console.log("HISTORY: ", history);
        // check if parameters are valid
        if (!email || !isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid email.");
            return next();
        }
        // TODO: ask professor what password format he wants
        else if (!password) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid password.");
            return next();
        }

        const session = await dbClient.startSession();
        await session.startTransaction();
        const newUser = {
            email: email,
            password: bcrypt.hashSync(password, saltRounds),
            balance: "0.00",
            moneyRequestHistory: history
        };
        try {
            const userExists = await User
                .findOne({ "email": email })
                .session(session);

            if (userExists) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.CONFLICT).send(`User account with email ${email} already exists.`);
                return next();
            }

            const newUserModel = new User(newUser);

            await newUserModel.save({ session });

            await session.commitTransaction();
            await session.endSession();


        } catch (error) {
            await session.abortTransaction();
            await session.endSession();
            res.status(RESPONSE.INTERNAL_SERVER_ERR).send(error);
            return next();
        }
        res.status(RESPONSE.CREATED).send(newUser);
        return next();
    }
);

/* for testing purposes */
router.get(
    '/all-users',
    async (req, res, next) => {
        let error = false;
        console.log("Fetching all users.");
        const users = await User
            .find({})
            .catch(err => {
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send(generateError(err));
            });
        
        if (error) return next();
        const retUsers = [];
        for (const user of users) {
            retUsers.push({
                email: user.email,
                password: user.password,
                balance: user.balance.toString(),
                moneyRequestHistory: parseUserRequestHistory(user)
            });
        }
        res.status(RESPONSE.OK).send(JSON.stringify(retUsers));
        return next();
    }
);

/* for testing purposes */
router.get(
    '/clear-users',
    async (req, res, next) => {
        let error = false;
        console.log("Deleting all users.");
        let ret = await User
            .deleteMany({})
            .catch(err => {
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();
        res.status(RESPONSE.OK).send(JSON.stringify(ret, null, 2));
        return next();
    }
);

export default router;