const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { ensureAuth } = require("../middleware/authMiddleware");

router.post("/checkout", ensureAuth, orderController.postCheckout);

module.exports = router;