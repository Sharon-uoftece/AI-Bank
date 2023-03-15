import mongoose from "mongoose";
import BigNumber from "bignumber.js";
import { assert } from "console";

const userSchemaLayout = {
    email: String,
    password: String,
    balance: {
        type: mongoose.Types.Decimal128,
        set: (value) => {
            if (value instanceof mongoose.Types.Decimal128) {
                value = value.toString();
            }
            assert(typeof value == 'string', `Value passed to balance must be a string, got ${value} of type ${typeof(value)}!`);
            const bigValue = new BigNumber(value);
            return mongoose.Types.Decimal128.fromString(bigValue.toFixed(2));
        }
    },
    moneyRequestHistory: [{
        serverId: String,
        orderId: String,
        status: String,
        amount: {
            type: mongoose.Types.Decimal128,
            set: (value) => {
                if (value instanceof mongoose.Types.Decimal128) {
                    value = value.toString();
                }
                assert(typeof value == 'string', `Value passed to money request history must be a string, got ${value} of type ${typeof(value)}!`);
                const bigValue = new BigNumber(value);
                return mongoose.Types.Decimal128.fromString(bigValue.toFixed(2));
            }
        },
        captureUrl: String,
        viewUrl: String,
        timeCreated: Date,
        timeCaptured: Date,
    }],
    timeCreated: {
        type: Date,
        default: Date.now
    },
};

const rwConcernLevels = {
    // writeConcern: {
    //     w: 1, // set the write concern level
    //     // j: true, // enable write journaling for extra durability
    // },
    readConcern: { level: 'linearizable' },
};

const userSchema = new mongoose.Schema(userSchemaLayout, rwConcernLevels);

export let dbClient;
export let User;

/* initializes connection and schema model to mongo db instance described by username password. */
/* This should only be called once on setup in index.js */
export async function initializeMongoDB(username, password) {
    const connectOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        
    };
    // const token = "mongodb+srv://utkrisli:Wanting521@cluster0.kdtesgu.mongodb.net/?retryWrites=true&w=majority";
    const accessToken = `mongodb+srv://${username}:${password}@cluster0.bazpvfn.mongodb.net/?retryWrites=true&w=majority`;
    dbClient = await mongoose.createConnection(accessToken, connectOptions).asPromise();
    User = dbClient.model('User', userSchema, 'users');
    console.log("Initialized mongoDB instance");
}