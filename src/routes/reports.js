const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { ensureAuth, ensureAdmin } = require("../middleware/authMiddleware");

router.use(ensureAuth, ensureAdmin);

// View Report
router.get("/sales", reportController.getSalesReport);

// Export Actions
router.get("/sales/export/daily", reportController.downloadDailySales);
router.get("/sales/export/detailed", reportController.downloadDetailedOrders);

module.exports = router;