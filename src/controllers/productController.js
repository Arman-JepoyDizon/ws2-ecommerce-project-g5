const { v4: uuidv4 } = require("uuid");

// List all products
exports.getList = async (req, res) => {
  const db = req.app.locals.db;
  
  const products = await db.collection("products").find().toArray();
  const categories = await db.collection("categories").find().toArray();
  
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.categoryId] = cat.name;
  });

  res.render("dashboard/products/index", {
    user: req.session.user,
    products,
    categoryMap,
    success: req.query.success || null
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

// Helper to parse variants from body
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
            // Single variant case
             variants.push({ name: names, price: parseFloat(prices) });
        }
    }
    return variants;
}

// Handle Create Submission
exports.postCreate = async (req, res) => {
  const db = req.app.locals.db;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);
  
  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
  }


  if (!name || (!hasVariants && isNaN(finalPrice)) || !categoryId) {
    const categories = await db.collection("categories").find().toArray();
    return res.render("dashboard/products/form", {
      user: req.session.user,
      product: { ...req.body, variants }, 
      categories,
      error: "Name, Category, and Price are required."
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
  res.redirect("/dashboard/admin/products?success=Product Created");
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

// Handle Edit Submission
exports.postEdit = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;
  const { name, description, price, categoryId, imgUrl, hasVariants } = req.body;

  const variants = parseVariants(req.body);

  let finalPrice = parseFloat(price);
  if (hasVariants === 'on' && variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
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

  res.redirect("/dashboard/admin/products?success=Product Updated");
};

// Handle Delete
exports.postDelete = async (req, res) => {
  const db = req.app.locals.db;
  const productId = req.params.id;

  await db.collection("products").deleteOne({ productId });
  res.redirect("/dashboard/admin/products?success=Product Deleted");
};