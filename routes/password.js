const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const SibApiV3Sdk = require('@getbrevo/brevo');

// Show forgot password form
router.get('/forgot', (req, res) => {
  res.render('forgot-password', { title: "Forgot Password" });
});

// Handle forgot password form submission
router.post('/forgot', async (req, res) => {
  try {
    const db = req.app.client.db(req.app.dbName);
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ email: req.body.email });
    if (!user) {
      return res.send("No account found with this email.");
    }

    // Generate reset token and expiry (1 hour)
    const token = uuidv4();
    const expiry = new Date(Date.now() + 3600000);

    // Save token in database
    await usersCollection.updateOne(
      { email: user.email },
      { $set: { resetToken: token, resetExpiry: expiry } }
    );

    // Build reset URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/password/reset/${token}`;

    // Configure Brevo client
    const brevoTransEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
    brevoTransEmailApi.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    // Build email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { email: process.env.BREVO_FROM_EMAIL, name: "Tagalog-Visakol-Ecommerce" };
    sendSmtpEmail.to = [{ email: user.email, name: `${user.firstName} ${user.lastName}` }];
    sendSmtpEmail.subject = "Password Reset Request";
    sendSmtpEmail.htmlContent = `
      <h2>Password Reset</h2>
      <p>Hello ${user.firstName || ""},</p>
      <p>You requested to reset your password. Click below to reset:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you didn’t request this, ignore this email.</p>
    `;

    // Send email
    await brevoTransEmailApi.sendTransacEmail(sendSmtpEmail);

    // Respond
    res.send("If an account with that email exists, a reset link has been sent.");

  } catch (err) {
    console.error("Error in password reset:", err);
    res.status(500).send("Something went wrong.");
  }
});

const bcrypt = require('bcrypt');
const saltRounds = 12;
// Show reset password form
router.get('/reset/:token', (req, res) => {
res.render('reset-password', { title: "Reset Password", token: req.params.token });
});
// Handle reset password form
router.post('/reset/:token', async (req, res) => {
try {
const db = req.app.client.db(req.app.dbName);
const usersCollection = db.collection('users');
// Find user by token and make sure it's not expired
const user = await usersCollection.findOne({
resetToken: req.params.token,
resetExpiry: { $gt: new Date() }
});
if (!user) {
return res.send("Reset link is invalid or has expired.");
}
// Check if passwords match
if (req.body.password !== req.body.confirm) {

return res.send("Passwords do not match.");
}
// Hash the new password
const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
// Update password in DB, clear token and expiry
await usersCollection.updateOne(
{ email: user.email },
{
$set: { passwordHash: hashedPassword, updatedAt: new Date() },
$unset: { resetToken: "", resetExpiry: "" }
}
);
res.send("Password has been reset. You can now log in with your new password.");
} catch (err) {
console.error("Error resetting password:", err);
res.send("Something went wrong.");
}
});

module.exports = router;
