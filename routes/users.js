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

//Registration (POST)
router.post('/register', async (req, res) =>{
    try {
        const db = req.app.client.db(req.app.dbName);
        const usersCollection = db.collection('users');

        //check if email already exists
        const existingUser = await usersCollection.findOne({
            email:req.body.email
        });
        if (existingUser) return res.send("User already exists with this email!");

        //Hashing Password
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const currentDate = new Date();

        //Build new user object
        const newUser = {
            userId: uuidv4(),
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            passwordHash: hashedPassword,
            role: 'customer',
            accountStatus: 'active',
            isEmailVerified: false,
            createdAt: currentDate,
            updatedAt: currentDate
        };

        //Insert into MongoDB
        await usersCollection.insertOne(newUser);
        res.send(`
            <h2>Registration Successful!</h2>

            <p>User ${newUser.firstName} ${newUser.lastName} registered with ID:
            
            ${newUser.userId}</p>
            
            <a href="/users/login">Proceed to Login</a>
        `);
    } catch (err) {
        console.error("Error saving user:", err);
        res.send("Something went wrong.");
    }
})

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