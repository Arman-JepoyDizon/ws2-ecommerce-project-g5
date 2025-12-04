  // src/server.js
  const verifyTurnstile = require('./utils/turnstileVerify');
  require("dotenv").config();
  const express = require("express");
  const session = require("express-session");
  const { MongoClient } = require("mongodb");
  const bodyParser = require("body-parser");
  const path = require("path");
 

  const app = express();
  const PORT = process.env.PORT || 3000;

  // --- Middleware ---
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  // --- View Engine ---
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // --- Static Files ---
  app.use(express.static(path.join(__dirname, "public")));

  // --- Database Setup ---
  async function initDB() {
    try {
      const client = new MongoClient(process.env.MONGO_URI);
      await client.connect();
      console.log("Connected to MongoDB");
      const db = client.db(process.env.DB_NAME || "onlyfreds");
      app.locals.db = db;

      // --- Session Setup ---
      app.set("trust proxy", 1);
      app.use(
        session({
          secret: process.env.SESSION_SECRET || "supersecretkey",
          resave: false,
          saveUninitialized: false,
          cookie: {
            maxAge: 1000 * 60 * 10,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
          },
        })
      );
      app.use((req, res, next) => {
      res.locals.currentPath = req.path;
      res.locals.user = req.session.user || null;

      if (req.session.user) {
          if (!req.session.lastActivity) {
          req.session.lastActivity = Date.now();
          } else {
          const now = Date.now();
          const diff = now - req.session.lastActivity;
          const maxIdle = 1000 * 60 * 10;

          if (diff > maxIdle) {
              req.session.destroy(() => {
              res.redirect("/auth/login?logout=inactive");
              });
              return;
          }

          req.session.lastActivity = now;
          }
      }
      next();
      });

      

      // --- Modular Routes ---
      const pagesRoutes = require("./routes/pages");
      app.use("/", pagesRoutes);

      const authRoutes = require("./routes/auth");
      app.use("/auth", authRoutes);
      
      const dashboardRoutes = require("./routes/dashboard");
      app.use("/dashboard", dashboardRoutes);
      const userRoutes = require("./routes/user");
      app.use("/user", userRoutes);
      const userManagementRoutes = require("./routes/userManagement");
      app.use("/dashboard/admin/users", userManagementRoutes);
      const categoryRoutes = require("./routes/categories");
      app.use("/dashboard/admin/categories", categoryRoutes);
      const productsRouter = require("./routes/products");
      app.use("/dashboard/admin/products", productsRouter);
      const cartRoutes = require("./routes/cart");
      app.use("/cart", cartRoutes);
      const orderRoutes = require("./routes/orders");
      app.use("/orders", orderRoutes);

      app.get('/crash', (req, res, next) => {
        throw new Error('Test crash');
      });
      app.get('/crash-async', async (req, res, next) => {
        try {
          throw new Error('Async crash');
        } catch (err) {
          next(err);
        }
      });

      app.use((req, res) => {
        res.status(404).render('404', {title:'Page not Found'});
      });
      app.use((err, req, res, next) => {
        console.error(err.stack);
        if (res.headersSent) return next(err);
          res.status(500).render('500', { title: 'Server Error', req });
          
      });


      // --- Start Server ---
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`OnlyFreds running at http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    }
  }

  // Start the app
  initDB();
