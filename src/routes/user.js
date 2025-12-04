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
router.post("/orders/:id/complete", userController.markOrderCompleted);
router.post("/orders/:id/pay", userController.payOrder); // NEW

module.exports = router;