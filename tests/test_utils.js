import { roundToTwoDecimals } from "../utils.js";
import { Chance } from "chance";
import BigNumber from "bignumber.js";
import * as uuid from "uuid";


export function generateError(msg) {
    return {
        error: msg
    }
}

/* Create users (possibly duplicates) */
/* Used in user-creation test suite */
export async function createUsersWithDuplicates(postUrl, numUsers) {
    const chance = new Chance();
    const generatedUsers = [];
    for (let i = 0; i < numUsers; i++) {
        // console.log(`Creating user number ${i}`);
        const val = Math.random() * 100;
        let data;
        if (val <= 40 && i > 0) {
            const item = generatedUsers[Math.floor(Math.random() * generatedUsers.length)];
            data = item;
        }
        else {
            const email = chance.email();
            data = {
                email: email,
                password: email.split("@")[0]
            };
            generatedUsers.push(data);
        }
        // Default options are marked with *
        await fetch(postUrl, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'application/json'
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data) // body data type must match "Content-Type" header
        })
            .catch(err => console.error(err));
    }
    return generatedUsers;
}

/* Create users with random account balances */
/* used in account-info test suite */
export async function createUsersWithRandBalances(postUrl, numUsers) {
    const chance = new Chance();
    const generatedUsers = [];
    for (let i = 0; i < numUsers; i++) {
        const rand = new BigNumber(Math.random());
        const balance = rand.multipliedBy(Math.random() * 10 ** 10).multipliedBy(Math.random() * 10 ** 10).toFixed(2);
        const email = chance.email();
        const data = {
            email: email,
            password: email.split("@")[0],
            balance: balance
        };
        generatedUsers.push(data);

        // Default options are marked with *
        await fetch(postUrl, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'application/json'
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data) // body data type must match "Content-Type" header
        })
            .catch(err => console.error(err));
    }

    return generatedUsers;
}

/* Create users with random transfer histories */
/* used in account-info test suite */
export async function createUsersWithRandHistories(postUrl, numUsers, maxHistoryLength) {
    const chance = new Chance();
    const generateRandomHistory = (numEntries) => {
        const history = [];
        const statusArr = ["pending-approval", "captured-by-server"];
        for (let i = 0; i < numEntries; i++) {
            const status = statusArr[Math.round(Math.random())];
            const rand = new BigNumber(Math.random());
            const entry = {
                serverId: uuid.v4(),
                orderId: uuid.v4(),
                status: status,
                amount: rand.multipliedBy(Math.random() * 10 ** 10).multipliedBy(Math.random() * 10 ** 10).toFixed(2),
                captureUrl: chance.url(),
                viewUrl: chance.url(),
                timeCreated: Date.now(),
                timeCaptured: status == "pending-approval" ? null : Date.now(),
            };
            history.push(entry);
        }
        return history;
    }

    const generatedUsers = [];
    for (let i = 0; i < numUsers; i++) {
        const numEntries = Math.round(Math.random() * maxHistoryLength);
        const email = chance.email();
        const data = {
            email: email,
            password: email.split("@")[0],
            history: generateRandomHistory(numEntries),
        };
        generatedUsers.push(data);

        // Default options are marked with *
        await fetch(postUrl, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'application/json'
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body: JSON.stringify(data) // body data type must match "Content-Type" header
        })
            .catch(err => console.error(err));
    }

    return generatedUsers;
}

/* Delete all users in database collection */
export async function clearCollection(url) {
    console.log("Awaiting clear collection fetch...");
    let i = 0;
    let failed = false;
    do {
        try {
            await fetch(url, {
                method: 'GET', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
                cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                credentials: 'same-origin', // include, *same-origin, omit
                headers: {
                    'Content-Type': 'application/json'
                    // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                redirect: 'follow', // manual, *follow, error
                referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            });
            failed = false;
            console.log("Finished clearing all users!");
        }
        catch (error) {
            failed = true;
            i++;
            console.log("GOT ERROR WHILE DELETING ALL USERS: ", error);
        }
    } while (i < 5 && failed)
    return;
}

export async function getAllUsers(getUrl) {
    let retrieved = [];
    await fetch(getUrl, {
        method: 'GET',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer', 
    })
    .then(responseString => responseString.json())
    .then(response => retrieved = response)
    .catch(err => console.error(err));
    return retrieved;
}