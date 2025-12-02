const verifyTurnstile = require("../utils/turnstileVerify");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const SibApiV3Sdk = require("@getbrevo/brevo");

const brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
brevoClient.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// GET Register
exports.getRegister = (req, res) => {
  res.render("auth/register", { error: null });
};

// POST Register
exports.postRegister = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const token = req.body['cf-turnstile-response'];
  const result = await verifyTurnstile(token, req.ip);
  if (!result.success) {
    return res.status(400).render('auth/register', { error: 'Verification failed. Please try again.' });
  }
  
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  // Password Validation
  if (password !== confirmPassword) {
    return res.render("auth/register", { error: "Passwords do not match." });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.render("auth/register", { 
        error: "Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 special character." 
    });
  }

  try {
    // Check duplicate
    const existing = await users.findOne({ email });
    if (existing) {
      return res.render("auth/register", { error: "Email already exists." });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Verification token
    const verificationToken = uuidv4();
    const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    const newUser = {
      userId: uuidv4(),
      firstName,
      lastName,
      email,
      passwordHash,
      role: "customer",
      accountStatus: "active",
      isEmailVerified: false,
      verificationToken,
      tokenExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await users.insertOne(newUser);

    // Send email via Brevo
    const emailData = {
      sender: { email: "no-reply@onlyfreds.fun", name: "OnlyFreds" },
      to: [{ email }],
      subject: "Verify your OnlyFreds account",
      htmlContent: `
        <h1>Welcome to OnlyFreds, ${firstName}!</h1>
        <p>Click below to verify your account:</p>
        <a href="${process.env.BASE_URL}/auth/verify/${verificationToken}">
          Verify Email
        </a>
      `,
    };

    await brevoClient.sendTransacEmail(emailData);

    res.render("auth/verify", { message: "Check your email to verify your account." });

  } catch (err) {
    console.error("Registration error:", err);
    res.render("auth/register", { error: "Something went wrong. Try again." });
  }
};

// Verify Email
exports.verifyEmail = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");

  const token = req.params.token;

  const user = await users.findOne({ verificationToken: token });
  if (!user) return res.render("auth/verify", { message: "Invalid token." });

  if (user.tokenExpiry < Date.now()) {
    return res.render("auth/verify", { message: "Token expired." });
  }

  await users.updateOne(
    { verificationToken: token },
    { $set: { isEmailVerified: true, verificationToken: null, tokenExpiry: null } }
  );

  res.render("auth/verify", { message: "Your email has been verified! You can log in now." });
};

// GET Login
exports.getLogin = (req, res) => {
  let error = null;
  let message = null;

  if (req.query.reset === "success") {
    message = "✅ Password has been reset successfully. You can now log in.";
  }

  if (req.query.logout === "inactive") {
     message = "⚠️ You’ve been logged out due to inactivity. Please log in again.";
  } else if (req.query.logout === "manual") {
     message = "✅ You have successfully logged out.";
  }

  if (req.query.error) {
    error = req.query.error;
  }

  res.render("auth/login", { 
    error: error,
    message: message, 
    user: req.session.user || null
  });
};

// POST Login
exports.postLogin = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const token = req.body['cf-turnstile-response'];
  const result = await verifyTurnstile(token, req.ip);
  
  if (!result.success) {
    return res.status(400).render('auth/login', { error: 'Verification failed. Please try again.', message: null });
  }
  const { email, password } = req.body;

  const user = await users.findOne({ email });
  if (!user) return res.render("auth/login", { error: "Invalid Credentials.", message: null });

  if (user.accountStatus !== "active") {
    return res.render("auth/login", { error: "Invalid Credentials.", message: null });
  }

  if (!user.isEmailVerified) {
    return res.render("auth/login", { error: "Invalid Credentials.", message: null });
  }

  const validPass = await bcrypt.compare(password, user.passwordHash);
  if (!validPass) return res.render("auth/login", { error: "Invalid Credentials.", message: null });

  // Set session
  req.session.user = {
    userId: user.userId,
    name: user.firstName,
    email: user.email,
    role: user.role,
  };

  if (user.role === "admin") {
    res.redirect("/dashboard/admin");
  } else {
    res.redirect("/dashboard/customer");
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login?logout=manual");
  });
};

// GET Forgot Password Page
exports.getForgotPassword = (req, res) => {
  res.render("auth/forgot", { error: null, message: null });
};

// POST Forgot Password
exports.postForgotPassword = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const token = req.body['cf-turnstile-response'];
  const result = await verifyTurnstile(token, req.ip);

  if (!result.success) {
    return res.status(400).render('auth/forgot', { error: 'Verification failed. Please try again.', message: null });
  }

  const { email } = req.body;
  
  try {
    const user = await users.findOne({ email });
    if (!user) {
      return res.render("auth/forgot", { error: null, message: "If an account with that email exists, a reset link has been sent." });
    }

    const resetToken = uuidv4();
    const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    await users.updateOne(
      { email },
      { $set: { verificationToken: resetToken, tokenExpiry } }
    );

    const emailData = {
      sender: { email: "no-reply@onlyfreds.fun", name: "OnlyFreds" },
      to: [{ email }],
      subject: "Reset your OnlyFreds password",
      htmlContent: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
        <a href="${process.env.BASE_URL}/auth/reset/${resetToken}">
          Reset Password
        </a>
      `,
    };

    await brevoClient.sendTransacEmail(emailData);

    res.render("auth/forgot", { error: null, message: "If an account with that email exists, a reset link has been sent." });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.render("auth/forgot", { error: "Something went wrong. Try again.", message: null });
  }
};

// GET Reset Password Page
exports.getResetPassword = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const token = req.params.token;

  try {
    const user = await users.findOne({ verificationToken: token });

    if (!user || user.tokenExpiry < Date.now()) {
      return res.render("auth/verify", { message: "Invalid or expired password reset token." });
    }

    res.render("auth/reset", { error: null, token: token });

  } catch (err) {
    console.error("Get reset password error:", err);
    res.render("auth/verify", { message: "An error occurred." });
  }
};

// POST Reset Password
exports.postResetPassword = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const turnstileToken = req.body['cf-turnstile-response'];
  const result = await verifyTurnstile(turnstileToken, req.ip);

  if (!result.success) {
    return res.status(400).render('auth/reset', { error: 'Verification failed. Please try again.', token: req.body.token });
  }

  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render("auth/reset", { error: "Passwords do not match.", token: token });
  }

  try {
    const user = await users.findOne({ verificationToken: token });

    if (!user || user.tokenExpiry < Date.now()) {
      return res.render("auth/verify", { message: "Invalid or expired password reset token." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await users.updateOne(
      { verificationToken: token },
      { $set: { 
          passwordHash: passwordHash, 
          verificationToken: null, 
          tokenExpiry: null 
        } 
      }
    );

    res.redirect("/auth/login?reset=success");

  } catch (err) {
    console.error("Post reset password error:", err);
    res.render("auth/reset", { error: "Something went wrong. Try again.", token: token });
  }
};