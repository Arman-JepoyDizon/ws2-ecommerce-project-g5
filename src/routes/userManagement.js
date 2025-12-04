const express = require("express");
const router = express.Router();
const userManagementController = require("../controllers/userManagementController");
const { ensureAuth, ensureAdmin } = require("../middleware/authMiddleware");

// Apply middleware
router.use(ensureAuth, ensureAdmin);

// List
router.get("/", userManagementController.getUsers);

// Actions
router.post("/ban", userManagementController.banUser);
router.post("/unban", userManagementController.unbanUser);

module.exports = router;