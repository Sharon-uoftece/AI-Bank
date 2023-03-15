/***************************************************
 * used for account info like balance, 
 * payment history, invoice history, request history,
 * transaction history etc.
 ***************************************************/
import { parseUserRequestHistory, SECRET, RESPONSE, generateError } from "../utils.js";
import express from "express";
import { User } from "../mongodb.js";
import bcrypt from "bcrypt";

const router = express.Router();
// Get from accounts/balance. Returns user account balance
router.get(
    '/balance/:email/:password',
    async (req, res, next) => {
        const email = req.params.email;
        const password = req.params.password;
        let error = false;
        const dataBaseUser = await User
            .findOne({ email: email })
            .select({ password: 1, balance: 1 })
            .catch(err => {
                error = true;
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send(generateError(err));
            });
        if (error) return next();
        // const password = req.params.password;
        if (dataBaseUser == null) {
            res.status(RESPONSE.NOT_FOUND).send(generateError(`Could not find user with email ${email}.`));
            return next();
        }
        if (!bcrypt.compareSync(password, dataBaseUser.password)) {
            res.status(RESPONSE.INVALID_AUTH).send(generateError("Incorrect user password."));
            return next();
        }
        const response = {
            balance: dataBaseUser.balance.toString()
        };
        res.status(RESPONSE.OK).send(JSON.stringify(response, null, 2));
        return next();
    }
);

/* TODO: maybe set limit ob how many request history entries to retrieve */
router.get(
    '/request-history/:email/:password',
    async (req, res, next) => {
        const email = req.params.email;
        const password = req.params.password;
        let error = false;
        const dataBaseUser = await User
            .findOne({ email: email })
            .select({ password: 1, moneyRequestHistory: 1 })
            .catch(err => {
                error = true;
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send(generateError(err));
            });
        if (error) return next();
        if (dataBaseUser == null) {
            res.status(RESPONSE.NOT_FOUND).send(generateError(`Could not find user with email ${email}.`));
            return next();
        }
        if (!bcrypt.compareSync(password, dataBaseUser.password)) {
            res.status(RESPONSE.INVALID_AUTH).send(generateError("Incorrect user password."));
            return next();
        }
        const parsedHistory = parseUserRequestHistory(dataBaseUser);
        res.status(RESPONSE.OK).send(JSON.stringify(parsedHistory, null, 2));
        return next();
    }
);


export default router;