// src/controllers/productController.js
const { v4: uuidv4 } = require("uuid");

// List all products (With Search & Filter)
exports.getList = async (req, res) => {
  const db = req.app.locals.db;
  const { search, category } = req.query;
  
  let query = {};

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  if (category) {
    query.categoryId = category;
  }
  
  const products = await db.collection("products").find(query).toArray();
  const categories = await db.collection("categories").find().toArray();
  
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.categoryId] = cat.name;
  });

  res.render("dashboard/products/index", {
    user: req.session.user,
    products,
    categories, 
    categoryMap,
    search: search || "",      
    selectedCategory: category || "", 
    success: req.query.success || null,
    error: req.query.error || null
  });
};

exports.getCreate = async (req, res) => {
  const db = req.app.locals.db;
  const categories = await db.collection("categories").find().toArray();

  res.render("dashboard/products/form", {
    user: req.session.user,
    product: null,
    categories,
    error: null
  });
};

function parseVariants(body) {
    let variants = [];
    if (body.hasVariants === 'on') {
        const names = body.variantNames;
        const prices = body.variantPrices;
        
        if (Array.isArray(names)) {
            names.forEach((name, index) => {
                if (name && prices[index]) {
                    variants.push({
                        name: name,
                        price: parseFloat(prices[index])
                    });
                }
            });
        } else if (names && prices) {
             variants.push({ name: names, price: parseFloat(prices) });
        }
    }
    return variants;
}

// NEW Helper: Check for duplicate variant names
function hasDuplicateVariants(variants) {
    const names = variants.map(v => v.name.toLowerCase().trim());
    return new Set(names).size !== names.length;
}

// Handle Create Submission (With Duplicate Check)
exports.postCreate = async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);
  
  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
  }

  // Validation Container
  let error = null;

  // 1. Basic Validation
  if (!name || !categoryId) {
      error = "Name and Category are required.";
  } 
  else if (!hasVariants && (isNaN(finalPrice) || finalPrice < 0)) {
      error = "Price must be a valid positive number.";
  }
  
  // 2. Duplicate Variant Check
  else if (hasVariants === 'on' && hasDuplicateVariants(variants)) {
      error = "Variant names must be unique.";
  }
  
  // 3. Duplicate Product Name Check
  else {
      const existingProduct = await db.collection("products").findOne({ 
          name: { $regex: `^${name}$`, $options: 'i' } // Case-insensitive check
      });
      if (existingProduct) {
          error = `A product with the name "${name}" already exists.`;
      }
  }
  
  // If Error: Re-render form with user input
  if (error) {
    const categories = await db.collection("categories").find().toArray();
    return res.render("dashboard/products/form", {
      user: req.session.user,
      // Pass back the body so the user doesn't lose text
      product: { ...req.body, variants }, 
      categories,
      error
    });
  }

  const newProduct = {
    productId: uuidv4(),
    name,
    description,
    price: finalPrice,
    categoryId,
    imgUrl: imgUrl || "",
    hasVariants: hasVariants === 'on',
    variants: variants,
    createdAt: new Date()
  };

  await db.collection("products").insertOne(newProduct);
  res.redirect("/dashboard/admin/products?success=Product Created Successfully");
};

// Show Edit Form
exports.getEdit = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;

  const product = await db.collection("products").findOne({ productId });
  const categories = await db.collection("categories").find().toArray();

  if (!product) {
    return res.redirect("/dashboard/admin/products");
  }

  res.render("dashboard/products/form", {
    user: req.session.user,
    product,
    categories,
    error: null
  });
};

// Handle Edit Submission (With Duplicate Check)
exports.postEdit = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);

  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
  }

  let error = null;

  // 1. Basic Validation
  if (!name || !categoryId) {
      error = "Name and Category are required.";
  }
  else if (!hasVariants && (isNaN(finalPrice) || finalPrice < 0)) {
      error = "Price must be a valid positive number.";
  }
  // 2. Duplicate Variant Check
  else if (hasVariants === 'on' && hasDuplicateVariants(variants)) {
      error = "Variant names must be unique.";
  }
  // 3. Duplicate Product Name Check (Exclude current ID)
  else {
      const existingProduct = await db.collection("products").findOne({ 
          name: { $regex: `^${name}$`, $options: 'i' },
          productId: { $ne: productId } // Exclude self
      });
      if (existingProduct) {
          error = `A product with the name "${name}" already exists.`;
      }
  }

  // If Error: Re-render form (DO NOT REDIRECT, or data is lost)
  if (error) {
      const categories = await db.collection("categories").find().toArray();
      return res.render("dashboard/products/form", {
        user: req.session.user,
        // Merge body with productId so the form action URL remains valid
        product: { ...req.body, productId, variants }, 
        categories,
        error
      });
  }

  await db.collection("products").updateOne(
    { productId },
    { 
      $set: { 
        name, 
        description, 
        price: finalPrice, 
        categoryId, 
        imgUrl,
        hasVariants: hasVariants === 'on',
        variants: variants,
        updatedAt: new Date() 
      } 
    }
  );

  res.redirect("/dashboard/admin/products?success=Product Updated Successfully");
};

// Handle Delete
exports.postDelete = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;

  try {
    const usageCount = await db.collection("orders").countDocuments({
        "items.productId": productId
    });

    if (usageCount > 0) {
        return res.redirect(`/dashboard/admin/products?error=Cannot delete this product because it is already used in ${usageCount} orders.`);
    }

    await db.collection("products").deleteOne({ productId });
    res.redirect("/dashboard/admin/products?success=Product Deleted Successfully");

  } catch (err) {
    console.error("Delete error:", err);
    res.redirect("/dashboard/admin/products?error=An error occurred while deleting.");
  }
};