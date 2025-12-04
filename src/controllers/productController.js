const { v4: uuidv4 } = require("uuid");

// List all products (With Search & Filter)
exports.getList = async (req, res) => {
  const db = req.app.locals.db;
  const { search, category } = req.query;
  
  // 1. Build Query
  let query = {};

  if (search) {
    // Case-insensitive search for name
    query.name = { $regex: search, $options: "i" };
  }

  if (category) {
    query.categoryId = category;
  }
  
  // 2. Fetch Data
  const products = await db.collection("products").find(query).toArray();
  const categories = await db.collection("categories").find().toArray();
  
  // Create a map for quick lookup: categoryId -> categoryName
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.categoryId] = cat.name;
  });

  res.render("dashboard/products/index", {
    user: req.session.user,
    products,
    categories, // Pass categories for the filter dropdown
    categoryMap,
    search: search || "",      // Keep search term in input
    selectedCategory: category || "", // Keep category selected
    success: req.query.success || null,
    error: req.query.error || null
  });
};

// Show Create Form
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

// Helper to parse variants
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

// Handle Create Submission (With Validation)
exports.postCreate = async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);
  
  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
  }

  // Validation
  let error = null;
  if (!name || !categoryId) error = "Name and Category are required.";
  else if (!hasVariants && (isNaN(finalPrice) || finalPrice < 0)) error = "Price must be a valid positive number.";
  
  if (error) {
    const categories = await db.collection("categories").find().toArray();
    return res.render("dashboard/products/form", {
      user: req.session.user,
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

// Handle Edit Submission (With Validation)
exports.postEdit = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);

  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
  }

  // Validation
  if (!name || (!hasVariants && (isNaN(finalPrice) || finalPrice < 0))) {
      // For edit, it's simpler to redirect with error than re-render entire state manually
      // or re-fetch product. A quick redirect is often acceptable for admin panels.
      return res.redirect(`/dashboard/admin/products/edit/${productId}?error=Invalid Input`);
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

// Handle Delete (With Safe Delete Check)
exports.postDelete = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;

  try {
    // 1. Check if product is in any order
    // We check the 'items.productId' field in the orders collection
    const usageCount = await db.collection("orders").countDocuments({
        "items.productId": productId
    });

    if (usageCount > 0) {
        return res.redirect(`/dashboard/admin/products?error=Cannot delete this product because it is already used in ${usageCount} orders.`);
    }

    // 2. If safe, delete
    await db.collection("products").deleteOne({ productId });
    res.redirect("/dashboard/admin/products?success=Product Deleted Successfully");

  } catch (err) {
    console.error("Delete error:", err);
    res.redirect("/dashboard/admin/products?error=An error occurred while deleting.");
  }
};