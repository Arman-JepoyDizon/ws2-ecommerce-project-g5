const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register
router.get("/register", authController.getRegister);
router.post("/register", authController.postRegister);

// Verify email
router.get("/verify/:token", authController.verifyEmail);

// Login
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

// Forgot Password
router.get("/forgot", authController.getForgotPassword);
router.post("/forgot", authController.postForgotPassword);

// Reset Password
router.get("/reset/:token", authController.getResetPassword);
router.post("/reset", authController.postResetPassword);

// Logout
router.get("/logout", authController.logout);

module.exports = router;