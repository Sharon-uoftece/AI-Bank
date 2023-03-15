import * as chai from "chai";
import { createUsersWithRandBalances, clearCollection, createUsersWithRandHistories } from "./test_utils.js";


const numUsers = 100;
describe("** Account Info Test Suite **", function () {
    // console.log("TEST SERVER: ", process.env.TEST_SERVER);
    const baseUrl = process.env.TEST_SERVER == '1' ? "http://ec2-3-138-246-144.us-east-2.compute.amazonaws.com/api" : "http://localhost:8080/api";
    const expect = chai.expect;
    const clearUrl = baseUrl + "/testing/clear-users";
    it(`1. Test account balance retrieval of ${numUsers} users on ${baseUrl}.`, async function () {
        this.timeout(0);
        await clearCollection(clearUrl);
        const postUrl = baseUrl + "/testing/new-with-balance";
        const generatedUsers = await createUsersWithRandBalances(postUrl, numUsers);
        for (const user of generatedUsers) {
            const getUrl = baseUrl + `/account-info/balance/${user.email}/${user.password}`;
            await fetch(getUrl, {
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
            })
            .then(responseString => responseString.json())
            .then(response => {
                /* the account balance retrieved should match the balance of the created user. */
                // console.log("RESPONSE: ", response);
                // console.log("BALANCE: ", user.balance.toFixed(2));
                expect(response.balance).to.equal(user.balance);
            });
        }
        await clearCollection(clearUrl);
    });
    it(`2. Test request history retrieval of ${numUsers} users on ${baseUrl}.`, async function () {
        const maxHistoryLength = 200;
        this.timeout(0);
        await clearCollection(clearUrl);
        const postUrl = baseUrl + "/testing/new-with-history";
        const generatedUsers = await createUsersWithRandHistories(postUrl, numUsers, maxHistoryLength);

        for (const user of generatedUsers) {
            const getUrl = baseUrl + `/account-info/request-history/${user.email}/${user.password}`;
            await fetch(getUrl, {
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
            })
            .then(responseString => responseString.json())
            .then(response => {
                /* convert timeCreated to millisecond form */
                const retrievedHistory = response.map((entry) => {
                    const created = new Date(entry.timeCreated);
                    const captured = entry.timeCaptured != null ? new Date(entry.timeCaptured) : null;
                    return {
                        ...entry,
                        timeCreated: created.getTime(),
                        timeCaptured: captured != null ? captured.getTime() : null,
                    }
                });
                expect(retrievedHistory).to.deep.equal(user.history);
            });
        }
        await clearCollection(clearUrl);

    });
});

