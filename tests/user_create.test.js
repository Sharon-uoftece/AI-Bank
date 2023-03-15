import * as chai from "chai";
import { createUsersWithDuplicates, clearCollection, getAllUsers } from "./test_utils.js";
import bcrypt from "bcrypt";
const numUsers = 100;
describe("** User Creation Test Suite **", function () {
    const expect = chai.expect;
    const baseUrl = process.env.TEST_SERVER == '1' ? "http://ec2-3-138-246-144.us-east-2.compute.amazonaws.com/api" : "http://localhost:8080/api";
    const postUrl = baseUrl + "/user-info/new";
    const getUrl = baseUrl + "/testing/all-users";
    const clearUrl = baseUrl + "/testing/clear-users";
    it(`1. Create ${numUsers} users with duplicates on ${baseUrl}.`, async function () {
        this.timeout(0);
        await clearCollection(clearUrl);
        const generatedUsers = await createUsersWithDuplicates(postUrl, numUsers);

        /* fetch all users in the database */
        const retrieved = await getAllUsers(getUrl);

        console.log(`Fetched ${retrieved.length} Users: `, retrieved);
        const expectedUsers = generatedUsers.map(user => {
            return {
                email: user.email,
                password: user.password
            };
        });

        const actualUsers = retrieved.map(user => {
            return {
                email: user.email,
                password: user.password
            };
        });

        expectedUsers.sort((user1, user2) => {
            if (user1.email < user2.email) {
                return -1;
            }
            if (user1.email > user2.email) {
                return 1;
            }
            return 0;
        });
        actualUsers.sort((user1, user2) => {
            if (user1.email < user2.email) {
                return -1;
            }
            if (user1.email > user2.email) {
                return 1;
            }
            return 0;
        });

        expect(expectedUsers.length).to.equal(actualUsers.length);

        for (let i = 0; i < expectedUsers.length; i++) {
            // console.log(`In for loop index: ${i}`);
            const isCorrectPass = bcrypt.compareSync(expectedUsers[i].password, actualUsers[i].password);
            expect(isCorrectPass).to.equal(true);
            expect(expectedUsers[i].email).to.equal(actualUsers[i].email);
        }
        await clearCollection(clearUrl);
    });
});

