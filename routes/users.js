//routes/users.js

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const { MongoClient } = require('mongodb');
require('dotenv').config();


//MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "ecommerceDB";

//Brevo
const SibApiV3Sdk = require('@getbrevo/brevo');


//Show Registration Form
router.get('/register', redirectLoggedInUsers, (req, res) => {
    res.render('register', {title: "Register"});
});

//Registration (POST)
router.post('/register', async (req, res) =>{
    try {
        const db = req.app.client.db(req.app.dbName);
        const usersCollection = db.collection('users');
        
        //1. Check if user already exists by email.
        
        const existingUser = await usersCollection.findOne({
            email:req.body.email
        });
        if (existingUser) {
            return res.send(`<script>alert("User already exists with this email!"); window.history.back();</script>`);
        }


        //2. Hashing Password
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const currentDate = new Date();

        //3. Create verification token
        const token = uuidv4();

        //4. Build new user object
        const newUser = {
            userId: uuidv4(), // unique ID for the user
            firstName: req.body.firstName, // from form input
            lastName: req.body.lastName,
            email: req.body.email,
            passwordHash: hashedPassword, // never store plain text password
            role: 'customer', // default role
            accountStatus: 'active',
            isEmailVerified: false, // must be verified before login
            verificationToken: token, // link user to verification
            tokenExpiry: new Date(Date.now() + 3600000), // expires in 1 hour
            createdAt: currentDate,
            updatedAt: currentDate
        };

        //5. Insert into MongoDB
        await usersCollection.insertOne(newUser);
        // Build verification URL
        const SibApiV3Sdk = require('@getbrevo/brevo');

        const brevoTransEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
        brevoTransEmailApi.setApiKey(
            SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/users/verify/${token}`;

        // Send email using Brevo
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender = { email: process.env.BREVO_FROM_EMAIL, name: "Tagalog-Visakol-Ecommerce" };
        sendSmtpEmail.to = [{ email: newUser.email, name: `${newUser.firstName} ${newUser.lastName}` }];
        sendSmtpEmail.subject = "Verify your account";
        sendSmtpEmail.htmlContent = `
        <h2>Welcome, ${newUser.firstName}!</h2>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        `;

        await brevoTransEmailApi.sendTransacEmail(sendSmtpEmail);

        res.send(`
                <script>
                    alert("Registered Successfully. Please check your email to verify your account. Verification will expire in 5 minutes."); window.history.back();
                </script>
            `);
    } catch (err) {
        console.error("Error saving user:", err);
        res.send("Something went wrong.");
    }
})

// Email Verification Route
router.get('/verify/:token', async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const usersCollection = db.collection('users');
        // 1. Find user by token
        const user = await usersCollection.findOne({ verificationToken: req.params.token });
        // 2. Check if token exists
        if (!user) {
            return res.send("Invalid or expired verification link.");
        }
        // 3. Check if token is still valid
        if (user.tokenExpiry < new Date()) {
            return res.send("Verification link has expired. Please register again.");
        }
        // 4. Update user as verified
        await usersCollection.updateOne(
            { verificationToken: req.params.token },
            { $set: { isEmailVerified: true }, $unset: { verificationToken: "", tokenExpiry:"" } }
        );
        res.send(`
            <h2>Email Verified!</h2>
            <p>Your account has been verified successfully.</p>
            <a href="/users/login">Proceed to Login</a>
        `);
    } catch (err) {
        console.error("Error verifying user:", err);
        res.send("Something went wrong during verification.");
    }
});


//Show Login Form
router.get('/login', redirectLoggedInUsers, (req, res) => {
    res.render('login', {title: "Login"});
});


//Handle Login form submission
router.post('/login', async (req, res) => {
    try {
        const db = req.app.client.db(req.app.dbName);
        const usersCollection = db.collection('users');

        //Find user by email
        const user = await usersCollection.findOne({ email: req.body.email});
        if (!user) return res.send("User not found.");

        //Check if account is active
        if (user.accountStatus !== 'active') return res.send("Accoiunt is not active.");
        if (!user.isEmailVerified) {
            return res.send("Please verify your email before logging in.");
        }
        //Compare Hashed Password
        const isPasswordvalid = await bcrypt.compare(req.body.password, user.passwordHash);
        if (isPasswordvalid) {
            //Store Session (Yipieee)
            req.session.user = {
                userId: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            };
            res.redirect('/users/dashboard');
        } else {
            res.send("Invalid Password.");
        }
    } catch (err) {
        console.error("Error during login: ", err);
        res.send("Something went wrong.");
    }
})

//Dashboard route (fetch fresh user from DB)
router.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/users/login');

    const db = req.app.client.db(req.app.dbName);
    const usersCollection = db.collection('users');

    // Always pull the latest user data from MongoDB
    const user = await usersCollection.findOne({ email: req.session.user.email });

    if (!user) {
        req.session.destroy(); // safety: if user was deleted
        return res.redirect('/users/login');
    }

    res.render('dashboard', { title: 'User Dashboard', user });
});


//Logout
router.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/users/login');
});

//Admin View
router.get('/admin', async(req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("Access Denied!");
    }

    const db = req.app.client.db(req.app.dbName);
    const users = await db.collection('users').find().toArray();

    res.render('admin', {
        title: "Admin Dashboard", 
        users,
        currentUser: req.session.user
    });
});

//Function to throw back users into dashboard if they are logged in.
function redirectLoggedInUsers(req, res, next) {
    if (req.session.user) {
        return res.redirect('/users/dashboard');
    }
    next();
};



//Show all registered users
router.get('/list', async (req, res) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        const usersCollection = db.collection('users');
        const users = await usersCollection.find().toArray();
        res.render('users-list', { title: "Registered Users", users: users });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.send("Something went wrong.");
    }
});

const { ObjectId } = require('mongodb');
// Show edit form
router.get('/edit/:id', async (req, res) => {
try {
await client.connect();
const db = client.db(dbName);
const usersCollection = db.collection('users');

const user = await usersCollection.findOne({ _id: new
ObjectId(req.params.id) });
if (!user) {
return res.send("User not found.");
}
res.render('edit-user', { title: "Edit User", user: user });
} catch (err) {
console.error("Error loading user:", err);
res.send("Something went wrong.");
}
});
// Handle update form
router.post('/edit/:id', async (req, res) => {
try {
await client.connect();
const db = client.db(dbName);
const usersCollection = db.collection('users');
await usersCollection.updateOne(
{ _id: new ObjectId(req.params.id) },
{ $set: { name: req.body.name, email: req.body.email } }
);
res.redirect('/users/list');
} catch (err) {
console.error("Error updating user:", err);
res.send("Something went wrong.");
}
});
// Delete User
router.post('/delete/:id', async (req, res) => {
    try {
    await client.connect();
        const db = client.db(dbName);
        const usersCollection = db.collection('users');

        await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.redirect('/users/list');
    } catch (err) {
        console.error("Error deleting user:", err);
        res.send("Something went wrong.");
    }
});
module.exports = router;