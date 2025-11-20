const { v4: uuidv4 } = require("uuid");

// List all categories
exports.getList = async (req, res) => {
  const db = req.app.locals.db;
  const categories = await db.collection("categories").find().toArray();
  
  res.render("dashboard/categories/index", {
    user: req.session.user,
    categories,
    error: null,
    success: req.query.success || null
  });
};

// Show Create Form
exports.getCreate = (req, res) => {
  res.render("dashboard/categories/form", {
    user: req.session.user,
    category: null,
    error: null
  });
};

// Handle Create Submission
exports.postCreate = async (req, res) => {
  const db = req.app.locals.db;
  const { name, description } = req.body;

  if (!name) {
    return res.render("dashboard/categories/form", {
      user: req.session.user,
      category: req.body,
      error: "Category Name is required"
    });
  }

  const newCategory = {
    categoryId: uuidv4(),
    name,
    description,
    createdAt: new Date()
  };

  await db.collection("categories").insertOne(newCategory);
  res.redirect("/dashboard/admin/categories?success=Category Created");
};

// Show Edit Form
exports.getEdit = async (req, res) => {
  const db = req.app.locals.db;
  const categoryId = req.params.id;
  
  const category = await db.collection("categories").findOne({ categoryId });

  if (!category) {
    return res.redirect("/dashboard/admin/categories");
  }

  res.render("dashboard/categories/form", {
    user: req.session.user,
    category,
    error: null
  });
};

// Handle Edit Submission
exports.postEdit = async (req, res) => {
  const db = req.app.locals.db;
  const categoryId = req.params.id;
  const { name, description } = req.body;

  await db.collection("categories").updateOne(
    { categoryId },
    { $set: { name, description, updatedAt: new Date() } }
  );

  res.redirect("/dashboard/admin/categories?success=Category Updated");
};

// Handle Delete
exports.postDelete = async (req, res) => {
  const db = req.app.locals.db;
  const categoryId = req.params.id;

  await db.collection("categories").deleteOne({ categoryId });
  res.redirect("/dashboard/admin/categories?success=Category Deleted");
};