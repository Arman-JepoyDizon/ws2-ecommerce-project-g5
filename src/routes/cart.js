const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { ensureAuth } = require("../middleware/authMiddleware");

router.use(ensureAuth);

router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.post("/update", cartController.updateCart); // NEW
router.post("/remove", cartController.removeFromCart);

module.exports = router;