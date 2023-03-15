import dontenv from "dotenv";
import bcrypt from "bcrypt";

dontenv.config();

export const RESPONSE = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    INVALID_AUTH: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERR: 500,
    SERVICE_UNAVAILABLE: 503,
});

export const PORT = process.env.LIVE ? process.env.LIVE_PORT : process.env.LOCAL_PORT;
export const DB_USERNAME = process.env.DB_USERNAME;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const SECRET = process.env.MD5_SECRET;
export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
export const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
export const SERVER_BASE_URL = process.env.LIVE ? process.env.SERVER_BASE_URL : process.env.LOCALHOST_BASE_URL;

export function isValidEmailFormat(email) {
    return typeof email == "string" && /^\S+@\S+\.\S+$/.test(email);
}

/* Transfer amount can only be a postive whole number, or a postive 2 decimal number */
export function isValidMoneyAmount(num) {
    const atMostTwoDecimals = /^\d+(\.\d{1,2})?$/;
    return typeof num == "string" && atMostTwoDecimals.test(num);
}

/* Request amount can only be a postive whole number, or a postive 2 decimal number, and must be less than 9999999.99 */
export function isValidRequestAmount(num) {
    const atMostTwoDecimals = /^\d+(\.\d{1,2})?$/;
    return typeof num == "string" && parseFloat(num) >= 0 && parseFloat(num) <= 9999999.99 && atMostTwoDecimals.test(num);
}

// Round num to two decimals, deals with invalid float addition error e.g. 0.1 + 0.2
export function roundToTwoDecimals(num) {
    return parseFloat(num.toFixed(2));
}

export function generateError(msg) {
    return {
        error: msg
    };
}

export function parseUserRequestHistory(userDocument) {
    if (!Array.isArray(userDocument.moneyRequestHistory)) {
        console.error("Expcted user request history to be array...");
        return [];
    }
    const userRequestHistory = [];
    for (const entry of userDocument.moneyRequestHistory) {
        userRequestHistory.push({
            serverId: entry.serverId,
            orderId: entry.orderId,
            status: entry.status,
            amount: entry.amount.toString(),
            captureUrl: entry.captureUrl,
            viewUrl: entry.viewUrl,
            timeCreated: entry.timeCreated,
            timeCaptured: entry.timeCaptured,
        });
    }
    return userRequestHistory;
}
