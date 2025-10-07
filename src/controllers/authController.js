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
  const { firstName, lastName, email, password } = req.body;

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
      sender: { email: "20237660@onlyfreds.fun", name: "OnlyFreds" },
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
  res.render("auth/login", { 
    error: null, 
    user: req.session.user || null, 
    logout: req.query.logout || null 
  });
};


// POST Login
exports.postLogin = async (req, res) => {
  const db = req.app.locals.db;
  const users = db.collection("users");
  const token = req.body['cf-turnstile-response'];
  const result = await verifyTurnstile(token, req.ip);
  if (!result.success) {
    return res.status(400).render('auth/login', { error: 'Verification failed. Please try again.' });
  }
  const { email, password } = req.body;

  const user = await users.findOne({ email });
  if (!user) return res.render("auth/login", { error: "Invalid Credentials." });

  if (user.accountStatus !== "active") {
    return res.render("auth/login", { error: "Invalid Credentials." });
  }

  if (!user.isEmailVerified) {
    return res.render("auth/login", { error: "Invalid Credentials." });
  }

  const validPass = await bcrypt.compare(password, user.passwordHash);
  if (!validPass) return res.render("auth/login", { error: "Invalid Credentials." });

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
