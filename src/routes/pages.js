const express = require("express");
const router = express.Router();
const pagesController = require("../controllers/pagesController");

// Home
router.get("/", pagesController.getIndex);

// Static Pages
router.get("/products", pagesController.getProducts);
router.get("/about", pagesController.getAbout);

// Contact (GET & POST)
router.get("/contact", pagesController.getContact);
router.post("/contact", pagesController.postContact);

router.get("/terms", pagesController.getTerms);
router.get("/privacy", pagesController.getPrivacy);

module.exports = router;