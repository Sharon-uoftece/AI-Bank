// TODO: confirm if we want to do this.
// Get from user-info/password. Returns user password
router.get(
    '/password/:email',
    async (req, res, next) => {
        const email = req.params.email;
        if (!isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send(`Please enter a valid email.`);
            return next();
        }
        let error = false;
        const user = await MongoUser
            .findOne({ "email": email })
            .select({ "password": 1 })
            .catch(err => {
                error = true;
                console.log("Get user password error: ", err);
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();

        console.log(user);
        if (user == null) {
            res.status(RESPONSE.NOT_FOUND).send(`Could not find user with email ${email}`);
            return next();
        }
        res.status(RESPONSE.OK).send(`Password: ${user.password}`);
        return next();
    }
);

// Remove a user
router.put(
    '/remove/:email',
    async (req, res, next) => {
        console.log("Handling create new user.");
        const email = req.params.email;

        // check if parameters are valid
        if (!email || !isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid email.");
            return next();
        }

        // check if user already exists in database
        let error = false;

        const ret = await MongoUser
            .findOneAndDelete({ email: email })
            .catch(msg => {
                error = true;
                console.log("Find error in remove user: ", msg);
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (ret == null) {
            res.status(RESPONSE.NOT_FOUND).send(`User to be removed with email ${email} does not exists.`);
            return next();
        }
        res.status(RESPONSE.OK).send(ret);
        return next();
    }
);

// Put to user-info/password. 
// Update an existing users password.
router.put(
    "/update-password/:email/:oldPassword/:newPassword",
    async (req, res, next) => {
        const email = req.params.email;
        const oldPassword = req.params.oldPassword;
        const newPassword = req.params.newPassword;
        if (!isValidEmailFormat(email)) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid email.");
            return next();
        }
        else if (!newPassword) {
            res.status(RESPONSE.BAD_REQUEST).send("Please enter a valid password.");
            return next();
        }
        let error = false;
        const user = await User
            .findOneAndUpdate({ email: email, password: md5(oldPassword, SECRET) }, { password: md5(newPassword, SECRET) })
            .catch(msg => {
                error = true;
                console.log("User password update error: ", msg);
                res.status(RESPONSE.INTERNAL_SERVER_ERR).send();
            });

        if (error) return next();

        console.log(user);
        if (user == null) {
            res.status(RESPONSE.INVALID_AUTH).send(`Invalid email or old password.`);
            return next();
        }
        // update password to new password
        res.status(RESPONSE.OK).send(`Updated password to: ${newPassword}`);
        return next();
    }
);

// payment_source: {
//     paypal: {
//         experience_context: {
//             payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
//             shipping_preference: "NO_SHIPPING",
//             payment_method_selected: "PAYPAL",
//             landing_page: "LOGIN",
//             user_action: "PAY_NOW",
//             return_url: `http://localhost:8080/api/transfer/external/capture-request/${uniqueId}`,
//         }
//     }
// },