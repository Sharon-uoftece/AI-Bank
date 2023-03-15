/***************************************************
 * used for user info like password, 
 * address, cellphone, email, create new user etc.
 ***************************************************/
import { RESPONSE, isValidEmailFormat, isValidMoneyAmount, SECRET, generateError } from "../utils.js";
import { User, dbClient } from "../mongodb.js";
import express from "express";
import bcrypt from "bcrypt";
// used for user info like password, address, cellphone, email, create new user etc.

// handle all routes under /api/user-info
const router = express.Router();
const saltRounds = 12;

// POST to user-info. Create a new user.
// used for testing purposes.
// Should be perfectly atomic
router.post(
    '/new',
    async (req, res, next) => {
        const email = req.body.email;
        const password = req.body.password;

        // check if parameters are valid
        if (!email || !isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Please enter a valid email."));
            return next();
        }
        // TODO: ask professor what password format he wants
        else if (!password) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Please enter a valid password."));
            return next();
        }

        const session = await dbClient.startSession();
        await session.startTransaction();
        try {
            const userExists = await User
                .findOne({ "email": email })
                .session(session);

            if (userExists) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.CONFLICT).send(generateError(`User account with email ${email} already exists.`));
                return next();
            }

            const newUser = {
                email: email,
                password: bcrypt.hashSync(password, saltRounds),
                balance: "0.00",
                moneyRequestHistory: []
            };

            const newUserModel = new User(newUser);

            await newUserModel.save({ session });

            await session.commitTransaction();
            await session.endSession();

            res.status(RESPONSE.CREATED).send(newUser);
            return next();

        } 
        catch (error) {
            await session.abortTransaction();
            await session.endSession();
            res.status(RESPONSE.INTERNAL_SERVER_ERR).send(generateError(error));
            return next();
        }
    }
);

export default router;
