const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { ensureAuth, ensureAdmin } = require("../middleware/authMiddleware");

// Apply middleware to all routes here
router.use(ensureAuth, ensureAdmin);

// List
router.get("/", categoryController.getList);

// Create
router.get("/new", categoryController.getCreate);
router.post("/new", categoryController.postCreate);

// Edit
router.get("/edit/:id", categoryController.getEdit);
router.post("/edit/:id", categoryController.postEdit);

// Delete
router.post("/delete/:id", categoryController.postDelete);

module.exports = router;