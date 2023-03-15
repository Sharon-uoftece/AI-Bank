/***************************************************
 * API 1 and 3
 * used to handle internal and external transactions.
 * sandbox password: "8e9aU?p
 ***************************************************/
import fetch from "node-fetch";
import {
    PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, RESPONSE, SERVER_BASE_URL,
    isValidMoneyAmount, isValidRequestAmount, roundToTwoDecimals, generateError, SECRET, isValidEmailFormat
} from "../utils.js";
import * as uuid from "uuid";
import paypal from "@paypal/checkout-server-sdk";
import { User, dbClient } from "../mongodb.js";
import express from "express";
import bcrypt from "bcrypt";

// TODO: update after go live, this link is for sandbox environment.
const base = "https://api.sandbox.paypal.com";

const requestStatus = Object.freeze({
    PENDING_APPROV: "pending-approval",
    CAPTURED: "captured-by-server",
});
// get access token
// Note need to recall as access tokens can expire.
// Handle 401 no auth from paypal.
async function getAccessToken() {
    let accessToken = "";
    const authUrl = "https://api-m.sandbox.paypal.com/v1/oauth2/token";
    const clientIdAndSecret = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`;
    const base64 = Buffer.from(clientIdAndSecret).toString('base64');
    await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
            'Authorization': `Basic ${base64}`,
        },
        body: 'grant_type=client_credentials'
    })
        .then(response => response.json())
        .then(data => {
            accessToken = data.access_token;
        })
        .catch(err => console.error("Couldn't get auth token with err: " + err));

    return accessToken;
};

async function capturePayment(captureUrl) {
    let error = false;
    // const url = `${base}/v2/checkout/orders/${orderId}/capture`;
    const response = await fetch(captureUrl, {
        method: "post",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
        },
    })
        .catch(err => {
            error = true;
            console.error("Error while fetching capturePayment " + err);
        });
    if (error) return null;
    const data = await response.json();
    return data;
}

let accessToken = await getAccessToken();
console.log("Got Access Token:", accessToken);
const router = express.Router();

// TODO: update SandboxEnvironment after we go live.
const paypalClient = new paypal.core.PayPalHttpClient(new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET));


// Flow: receive request from frontend, create request and return redirect link to user
// user navigates to link and approves, frontend calls capture of backend,
// capture then updates user balnces.
// https://developer.paypal.com/docs/checkout/standard/integrate/
// https://developer.paypal.com/docs/api/orders/v2/#error-ORDER_NOT_APPROVED
router.post(
    "/external/create-request",
    async (req, res, next) => {
        let uniqueId;
        let error = false;
        const requestorEmail = req.body.email;
        const requestorPassword = req.body.password;
        const moneyAmount = req.body.amount;
        if (!isValidRequestAmount(moneyAmount)) {
            res.status(RESPONSE.BAD_REQUEST).send("Amount to request is invalid. Must be less than or equal to 9999999.99.");
            return next();
        }

        const dataBaseRequestor = await User
            .findOne({ email: requestorEmail })
            .select({ password: 1 })
            .catch(msg => {
                error = true;
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();
        if (dataBaseRequestor == null) {
            req.status(RESPONSE.NOT_FOUND).send("User not found.");
            return next();
        }

        if (!bcrypt.compareSync(requestorPassword, dataBaseRequestor.password)) {
            req.status(RESPONSE.INVALID_AUTH).send("Invalid password");
            return next();
        }

        const request = new paypal.orders.OrdersCreateRequest();
        const total = moneyAmount;
        request.prefer("return=representation");
        uniqueId = uuid.v4();

        const amount = {
            currency_code: 'CAD',
            value: total,
            breakdown: {
                item_total: {
                    currency_code: 'CAD',
                    value: total
                }
            }
        };

        const items = [{
            name: `Money Request From ${requestorEmail}`,
            unit_amount: {
                currency_code: "CAD",
                value: total
            },
            quantity: 1
        }];

        request.requestBody({
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: amount,
                    items: items,
                }
            ],
            application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                return_url: `${SERVER_BASE_URL}/api/transfer/external/capture-request/${requestorEmail}/${uniqueId}`
            },

        });
        console.log("Return url: " + `${SERVER_BASE_URL}/api/transfer/external/capture-request/${requestorEmail}/${uniqueId}`);
        const order = await paypalClient
            .execute(request)
            .catch(err => {
                error = true;
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send(err);
            });
        console.log("ORDER: ", order);
        if (error) return next();
        const orderId = order.result.id;
        const captureLinkObj = Array.isArray(order.result.links) && order.result.links.find((obj) => obj.rel == "capture");
        const viewLinkObj = Array.isArray(order.result.links) && order.result.links.find((obj) => obj.rel == "self");
        const approveLinkObj = Array.isArray(order.result.links) && order.result.links.find((obj) => obj.rel == "approve");
        if (!captureLinkObj || !viewLinkObj || !approveLinkObj) {
            res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            console.log("Unexpected capture/view link.");
            return next();
        }

        const newMoneyRequest = {
            serverId: uniqueId,
            orderId: orderId,
            status: requestStatus.PENDING_APPROV,
            amount: moneyAmount,
            captureUrl: captureLinkObj.href,
            viewUrl: viewLinkObj.href,
            timeCreated: Date.now(),
            timeCaptured: null,
        };

        await User
            .updateOne({ email: requestorEmail }, {
                $push: { moneyRequestHistory: newMoneyRequest }
            })
            .catch(err => {
                error = true;
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send(err);
            });

        if (error) return next();
        res.status(RESPONSE.OK).send({
            completionUrl: approveLinkObj.href
        });
        return next();
    }
);

router.get(
    "/external/capture-request/:email/:uniqueId",
    async (req, res, next) => {
        console.log("Capturing request.");
        let error = false;
        const email = req.params.email;
        const uniqueId = req.params.uniqueId;
        if (!uuid.validate(uniqueId)) {
            res.status(RESPONSE.INVALID_AUTH).send("Invalid Order Unique Id.");
            return next();
        }
        const user = await User
            .findOne({ email: email })
            .select({ moneyRequestHistory: 1, balance: 1 })
            .catch(err => {
                error = true;
                req.status(RESPONSE.INTERNAL_SERVER_ERR).send(err);
            });

        if (error) return next();
        if (!user) {
            req.status(RESPONSE.NOT_FOUND).send("User not found.");
            return next();
        }
        const order = user.moneyRequestHistory.find((request) => request.serverId == uniqueId);
        if (!order) {
            res.status(RESPONSE.NOT_FOUND).send("Order not found.");
            return next();
        }
        if (order.status != requestStatus.PENDING_APPROV) {
            res.status(RESPONSE.CONFLICT).send("Order already captured.");
            return next();
        }
        const captureRes = await (capturePayment(order.captureUrl, accessToken));
        console.log("Capture Payment Response: ", JSON.stringify(captureRes, null, 2));
        
	if (captureRes == null) {
            req.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            return next();
        }

        // TODO: may need to synchronize for multiple, parallel captures.
        order.status = requestStatus.CAPTURED;
        // order.amount = order.amount.toString();
        order.timeCaptured = Date.now();
        await User
            .findOneAndUpdate({ email: email }, {
                moneyRequestHistory: user.moneyRequestHistory,
                $inc: { balance: order.amount }
            })
            .catch(err => {
                error = true;
                req.status(RESPONSE.INTERNAL_SERVER_ERR).send(err);
            });

        if (error) return next();
  
        res.status(RESPONSE.OK).send("Transfer Success.");
        return next();
    }
);

// When a user spends money externally, it goes through the front end and the balance
// of the master account gets deducted.
// The frontend further queries the API to deduct the balance of the user that spent the money.
router.post(
    "/spend",
    async (req, res, next) => {
        const userEmail = req.body.email;
        /* spendAmount should be a string */
        const spendAmount = req.body.amount;
        const password = req.body.password;
        let error = false;
        if (!isValidEmailFormat(userEmail)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid user email format."));
            return next();
        }
        if (!isValidMoneyAmount(spendAmount)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid amount to spend."));
            return next();
        }

        /* try to find a user with the entered email */
        const user = await User.findOne({ email: userEmail });

        /* check if the user exists and the password is correct */
        if (user == null) {
            res.status(RESPONSE.NOT_FOUND).send(generateError(`Could not find user with email ${userEmail}.`));
            return next();
        }

        const hashedPassword = user.password;
        if (!bcrypt.compareSync(password, hashedPassword)) {
            res.status(RESPONSE.INVALID_AUTH).send(generateError("Incorrect user password."));
            return next();
        }

        /* update the user balance with negative spend amount. */
        const updatedUser = await User
            .findOneAndUpdate({ email: userEmail, password: hashedPassword, balance: { $gte: spendAmount } },
                { $inc: { balance: "-" + spendAmount } },
                { new: true }
            )
            .catch(msg => {
                error = true;
                console.log("Internal spend update error: ", msg);
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();

        /*  if updatedUser is null, then likely the user had insufficient funds.
            However, with very small probability, the user could have changed their password between
            findOne and findOneAndUpdate */
        if (updatedUser == null) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid credentials or insufficient funds."));
            return next();
        }

        /* send the new user balance as response. */
        res.status(RESPONSE.OK).send({
            balance: updatedUser.balance.toString()
        });
        return next();
    }
);


// Perform internal transfer.
router.post(
    "/internal",
    async (req, res, next) => {
        // console.log("Handling internal transfer with write concern: ", dbClient.writeConcern);

        const sender = req.body.sender;
        const receiver = req.body.receiver;
        const senderPassword = req.body.senderPassword;
        const moneyAmount = req.body.amount;
        // console.log("BODY: ", req.body);
        if (!isValidEmailFormat(sender)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid sender email format."));
            return next();
        }
        if (!isValidEmailFormat(receiver)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid receiver email format."));
            return next();
        }
        if (!isValidMoneyAmount(moneyAmount)) {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Amount to transfer is invalid."));
            return next();
        }
        if (typeof senderPassword != "string") {
            res.status(RESPONSE.BAD_REQUEST).send(generateError("Invalid sender password format."));
            return next();
        }
        let error = false;

        /* check if receiver exists */
        const receiveUser = await User
            .findOne({ email: receiver })
            .catch(msg => {
                error = true;
                // console.log("User balance find error: ", msg);
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();

        if (receiveUser == null) {
            res.status(RESPONSE.NOT_FOUND).send(generateError(`Could not find receiver with email ${receiver}.`));
            return next();
        }

        const session = await dbClient.startSession();
        await session.startTransaction();
        try {
            const sendUser = await User.findOne( { email: sender }, null, { session: session });
            if (sendUser == null) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.NOT_FOUND).send(generateError(`Could not find sender with email ${sender}.`));
                return next();
            }

            const hashedPassword = sendUser.password;
            if (!bcrypt.compareSync(senderPassword, hashedPassword)) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.INVALID_AUTH).send(generateError("Incorrect sender password."));
                return next();
            }
            const sendUserUpdated = await User
                .findOneAndUpdate({ email: sender, password: hashedPassword, balance: { $gte: moneyAmount } },
                    { $inc: { balance: "-" + moneyAmount } },
                    { session: session, new: true }
                );
            // console.log("Finished updating sender");
            if (sendUserUpdated == null) {
                await session.abortTransaction();
                await session.endSession();
                res.status(RESPONSE.NOT_FOUND).send(generateError("Insufficient funds in sender account."));
                return next();
            }

            const receiveUserUpdated = await User
                .findOneAndUpdate({ email: receiver },
                    { $inc: { balance: moneyAmount } },
                    { session: session, new: true }
                );
            // console.log("Finished updating receiver");

            await session.commitTransaction();
            await session.endSession();
            res.status(RESPONSE.OK).send({
                senderBalance: sendUserUpdated.balance.toString(),
                receiverBalance: receiveUserUpdated.balance.toString()
            });
            return next();

        }
        catch (error) {
            console.error("Error: ", error);
            await session.abortTransaction();
            await session.endSession();
            res.status(RESPONSE.INTERNAL_SERVER_ERR).send(generateError(error));
            return next();
        }
    }
);

export default router;
