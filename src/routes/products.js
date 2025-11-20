const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { ensureAuth, ensureAdmin } = require("../middleware/authMiddleware");

// Apply middleware to all routes
router.use(ensureAuth, ensureAdmin);

// List
router.get("/", productController.getList);

// Create
router.get("/new", productController.getCreate);
router.post("/new", productController.postCreate);

// Edit
router.get("/edit/:id", productController.getEdit);
router.post("/edit/:id", productController.postEdit);

// Delete
router.post("/delete/:id", productController.postDelete);

module.exports = router;