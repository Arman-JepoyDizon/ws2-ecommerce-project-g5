const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// Auth middleware
function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

router.get("/customer", ensureAuth, dashboardController.getCustomerDashboard);
router.get("/admin", ensureAuth, dashboardController.getAdminDashboard);

module.exports = router;
