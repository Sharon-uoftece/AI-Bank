import * as chai from "chai";
import { createUsersWithRandBalances, clearCollection, generateError } from "./test_utils.js";
import { isValidMoneyAmount, SECRET } from "../utils.js";
import BigNumber from "bignumber.js";
import bcrypt from "bcrypt";

const numUsers = 50;
const numIterations = numUsers * 10;
describe("** Transfer Test Suite **", function () {
    this.maxDiff = 10 ** 6;
    const expect = chai.expect;
    const baseUrl = process.env.TEST_SERVER == '1' ? "http://ec2-3-138-246-144.us-east-2.compute.amazonaws.com/api" : "http://localhost:8080/api";
    const clearUrl = baseUrl + "/testing/clear-users";
    it(`1. Spend money randomly ${numIterations} times on a set of ${numUsers} users on ${baseUrl}.`, async function () {
        const getUrl = baseUrl + "/testing/all-users";
        const spendUrl = baseUrl + "/transfer/spend";
        this.timeout(0);
        await clearCollection(clearUrl);
        const generatedUsers = await createUsersWithRandBalances(baseUrl + "/testing/new-with-balance", numUsers);
        const expectedReponses = [];
        const receivedResponses = [];
        for (let i = 0; i < numIterations; i++) {
            const user = generatedUsers[Math.floor(Math.random() * numUsers)];
            // 5% chance to send a wrong email format.
            const wrongEmailFormat = Math.random() <= 0.05;
            // 10% chance to send a non-existant user email
            const nonExistentEmail = Math.random() <= 0.1;
            // 20% chance to send a wrong password.
            const wrongPassword = Math.random() <= 0.2;
            // 30% chance to send a probably wrong amount.
            let email = user.email;
            if (wrongEmailFormat) {
                const rand = Math.random();
                email = rand >= 0.5 ? user.email.replaceAll('@', '') : user.email.replaceAll('.', '');
            }
            else if (nonExistentEmail) {
                email = 'this_is_wrong_' + user.email;
            }
            const rand = new BigNumber(Math.random());
            const amount = rand.multipliedBy(Math.random() * (10 ** 9)).multipliedBy(Math.random() * (10 ** 9));
            const body = {
                email: email,
                password: !wrongPassword ? user.password : 'this_is_wrong_' + user.password,
                amount: Math.random() <= 0.3 ? amount.toFixed(3) : amount.toFixed(2),
            };
            if (wrongEmailFormat) {
                expectedReponses.push(generateError("Invalid user email format."));
            }
            else if (!isValidMoneyAmount(body.amount)) {
                expectedReponses.push(generateError("Invalid amount to spend."));
            }
            else if (nonExistentEmail) {
                expectedReponses.push(generateError(`Could not find user with email ${email}.`));
            }
            else if (wrongPassword) {
                expectedReponses.push(generateError("Incorrect user password."));
            }
            else if (amount.isGreaterThan(new BigNumber(user.balance))) {
                expectedReponses.push(generateError("Invalid credentials or insufficient funds."));
            }
            /* if all checks pass, update user balance */
            else {
                const newBalance = BigNumber(user.balance).minus(amount).toFixed(2);
                expectedReponses.push({
                    balance: newBalance
                });
                user.balance = newBalance;
            }
            await fetch(spendUrl, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                body: JSON.stringify(body)
            })
            .then(resp => resp.json())
            .then(response => {
                receivedResponses.push(response);
            });
        }
        expect(receivedResponses).to.deep.equal(expectedReponses);

        let dbAllUsers = [];
        /* fetch all users in the database */
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
        .then(response => dbAllUsers = response)
        .catch(err => console.error(err));
        dbAllUsers = dbAllUsers.map((user) => {
            return {
                email: user.email,
                password: user.password,
                balance: user.balance,
            }
        });

        const expectedUsers = generatedUsers.map((user) => {
            return {
                email: user.email,
                password: user.password,
                balance: user.balance
            }
        });
        expectedUsers.sort((user1, user2) => {
            return user1.email < user2.email;
        });

        dbAllUsers.sort((user1, user2) => {
            return user1.email < user2.email;
        });

        expect(expectedUsers.length).to.equal(dbAllUsers.length);
        for (let i = 0; i < expectedUsers.length; i++) {
            const isCorrectPass = bcrypt.compareSync(expectedUsers[i].password, dbAllUsers[i].password);
            expect(isCorrectPass).to.equal(true);
            expect(expectedUsers[i].email).to.equal(dbAllUsers[i].email);
            expect(expectedUsers[i].balance).to.equal(dbAllUsers[i].balance);
        }
        // expect(expectedUsers).to.deep.equal(dbAllUsers);
        await clearCollection(clearUrl);
    });
    it(`2. Perform ${numIterations} of internal transfers on a set of ${numUsers} users on ${baseUrl}.`, async function () {
        const getUrl = baseUrl + "/testing/all-users";
        const transferUrl = baseUrl + "/transfer/internal";
        this.timeout(0);
        await clearCollection(clearUrl);
        const generatedUsers = await createUsersWithRandBalances(baseUrl + "/testing/new-with-balance", numUsers);
        const expectedReponses = [];
        const receivedResponses = [];
        for (let i = 0; i < numIterations; i++) {
            const receiverIndex = Math.floor(Math.random() * numUsers);
            let senderIndex = 0;
            do {
                senderIndex = Math.floor(Math.random() * numUsers);
            } while (senderIndex == receiverIndex);


            const receiver = generatedUsers[receiverIndex];
            const sender = generatedUsers[senderIndex];
            // 5% chance to send a wrong email format.
            const wrongEmailFormat = Math.random() <= 0.05;
            // 10% chance to send a non-existant user email
            const nonExistentEmail = Math.random() <= 0.1;
            // 20% chance to send a wrong password.
            const wrongPassword = Math.random() <= 0.2;
            // 30% chance to send a probably wrong amount.
            let senderEmail = sender.email;
            if (wrongEmailFormat) {
                const rand = Math.random();
                senderEmail = rand >= 0.5 ? sender.email.replaceAll('@', '') : sender.email.replaceAll('.', '');
            }
            else if (nonExistentEmail) {
                senderEmail = 'this_is_wrong_' + sender.email;
            }
            const rand = new BigNumber(Math.random());
            const amount = rand.multipliedBy(Math.random() * 10 ** 9).multipliedBy(Math.random() * 10 ** 9);
            const body = {
                sender: senderEmail,
                receiver: receiver.email,
                senderPassword: !wrongPassword ? sender.password : 'this_is_wrong_' + sender.password,
                amount: Math.random() <= 0.3 ? amount.toFixed(3) : amount.toFixed(2),
            };
            if (wrongEmailFormat) {
                expectedReponses.push(generateError("Invalid sender email format."));
            }
            else if (!isValidMoneyAmount(body.amount)) {
                expectedReponses.push(generateError("Amount to transfer is invalid."));
            }
            else if (nonExistentEmail) {
                expectedReponses.push(generateError(`Could not find sender with email ${senderEmail}.`));
            }
            else if (wrongPassword) {
                expectedReponses.push(generateError("Incorrect sender password."));
            }
            else if (amount.isGreaterThan(new BigNumber(sender.balance))) {
                expectedReponses.push(generateError("Insufficient funds in sender account."));
            }
            /* if all checks pass, update user balance */
            else {
                const newSenderBalance = BigNumber(sender.balance).minus(amount).toFixed(2);
                const newReceiverBalance = BigNumber(receiver.balance).plus(amount).toFixed(2);
                expectedReponses.push({
                    senderBalance: newSenderBalance,
                    receiverBalance: newReceiverBalance
                });
                sender.balance = newSenderBalance;
                receiver.balance = newReceiverBalance;
            }
            await fetch(transferUrl, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                body: JSON.stringify(body)
            })
            .then(resp => resp.json())
            .then(response => {
                receivedResponses.push(response);
            });
        }
        // console.log("RECEIVED RESPONSES: ", receivedResponses);
        expect(receivedResponses).to.deep.equal(expectedReponses);

        let dbAllUsers = [];
        /* fetch all users in the database */
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
        .then(response => dbAllUsers = response)
        .catch(err => console.error(err));
        dbAllUsers = dbAllUsers.map((user) => {
            return {
                email: user.email,
                password: user.password,
                balance: user.balance,
            }
        });

        const expectedUsers = generatedUsers.map((user) => {
            return {
                email: user.email,
                password: user.password,
                balance: user.balance
            }
        });
        expectedUsers.sort((user1, user2) => {
            return user1.email < user2.email;
        });

        dbAllUsers.sort((user1, user2) => {
            return user1.email < user2.email;
        });

        expect(expectedUsers.length).to.equal(dbAllUsers.length);
        for (let i = 0; i < expectedUsers.length; i++) {
            const isCorrectPass = bcrypt.compareSync(expectedUsers[i].password, dbAllUsers[i].password);
            expect(isCorrectPass).to.equal(true);
            expect(expectedUsers[i].email).to.equal(dbAllUsers[i].email);
            expect(expectedUsers[i].balance).to.equal(dbAllUsers[i].balance);
        }

        //expect(expectedUsers).to.deep.equal(dbAllUsers);
        await clearCollection(clearUrl);
    });
});
