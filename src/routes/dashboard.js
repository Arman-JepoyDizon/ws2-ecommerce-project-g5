const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { ensureAuth, ensureAdmin } = require("../middleware/authMiddleware");

// Customer Dashboard
router.get("/customer", ensureAuth, dashboardController.getCustomerDashboard);

// Admin Dashboard
router.get("/admin", ensureAuth, ensureAdmin, dashboardController.getAdminDashboard);

// Admin Orders List
router.get("/admin/orders", ensureAuth, ensureAdmin, dashboardController.getAdminOrders);

// Admin Order Detail
router.get("/admin/orders/:id", ensureAuth, ensureAdmin, dashboardController.getAdminOrderDetail);

//Status Update
router.post("/admin/orders/:id/status", ensureAuth, ensureAdmin, dashboardController.updateOrderStatus);

module.exports = router;
