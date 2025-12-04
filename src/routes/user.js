const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { ensureAuth } = require("../middleware/authMiddleware");

router.use(ensureAuth);

// Profile
router.get("/profile", userController.getProfile);
router.post("/profile", userController.updateProfile);

// Orders
router.get("/orders", userController.getOrders);

// Mark as Completed
router.post("/orders/:id/complete", userController.markOrderCompleted);

module.exports = router;