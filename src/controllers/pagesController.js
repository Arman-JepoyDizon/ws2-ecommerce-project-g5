const verifyTurnstile = require("../utils/turnstileVerify");
const SibApiV3Sdk = require("@getbrevo/brevo");

// Initialize Brevo Client
const brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
brevoClient.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// --- HOME PAGE ---
exports.getIndex = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const productsCollection = db.collection("products");

    // 1. Fetch Featured (Placeholder: First 3 products)
    const featuredProducts = await productsCollection.find().limit(3).toArray();

    // 2. Fetch Newest (Sorted by Date Descending)
    const newestProducts = await productsCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.render("index", {
      user: req.session.user || null,
      featuredProducts,
      newestProducts
    });
  } catch (err) {
    console.error("Error fetching homepage data:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};



// --- PRODUCTS PAGE ---
exports.getProducts = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const categoryId = req.query.category; // Get category from URL query

    // 1. Fetch all categories for the filter bar
    const categories = await db.collection("categories").find().toArray();

    // 2. Build Query
    let query = {};
    if (categoryId && categoryId !== 'all') {
        query.categoryId = categoryId;
    }

    // 3. Fetch Products (Filtered)
    const products = await db.collection("products").find(query).toArray();
    
    res.render("products", { 
      user: req.session.user || null, 
      freddyProducts: products,
      categories: categories,
      selectedCategory: categoryId || 'all'
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

exports.getAbout = (req, res) => {
  res.render("about", { user: req.session.user || null });
};

// GET Contact Page
exports.getContact = (req, res) => {
  res.render("contact", { 
    user: req.session.user || null,
    success: null,
    error: null 
  });
};

// POST Contact Form
exports.postContact = async (req, res) => {
  const { name, email, subject, message } = req.body;
  const token = req.body['cf-turnstile-response'];

  // 1. Verify Turnstile
  const result = await verifyTurnstile(token, req.ip);
  if (!result.success) {
    return res.render("contact", { 
      user: req.session.user || null, 
      error: "Verification failed. Please try again.",
      success: null
    });
  }

  try {
    // 2. Send Email via Brevo
    const emailData = {
      sender: { email: "no-reply@onlyfreds.fun", name: "OnlyFreds Contact Form" },
      to: [{ email: "20237660@s.ubaguio.edu" }], 
      replyTo: { email: email, name: name },
      subject: `[Contact Form] ${subject}`,
      htmlContent: `
        <h3>New Message from OnlyFreds Contact Form</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    };

    await brevoClient.sendTransacEmail(emailData);

    res.render("contact", { 
      user: req.session.user || null,
      success: "Message sent successfully! We'll get back to you soon.",
      error: null
    });

  } catch (err) {
    console.error("Contact Form Error:", err);
    res.render("contact", { 
      user: req.session.user || null,
      error: "Something went wrong sending your message. Please try again.",
      success: null
    });
  }
};

exports.getTerms = (req, res) => {
  res.render("terms", { user: req.session.user || null });
};

exports.getPrivacy = (req, res) => {
  res.render("privacy", { user: req.session.user || null });
};

// --- PRODUCT DETAIL PAGE ---
exports.getProductDetail = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const productId = req.params.id;

    // 1. Fetch Product
    const product = await db.collection("products").findOne({ productId });

    if (!product) {
      return res.status(404).render("404", { title: "Product Not Found" });
    }

    // 2. Fetch Category Name (for the badge)
    let categoryName = "Uncategorized";
    if (product.categoryId) {
        const category = await db.collection("categories").findOne({ categoryId: product.categoryId });
        if (category) categoryName = category.name;
    }

    res.render("product-detail", {
      user: req.session.user || null,
      product,
      categoryName
    });

  } catch (err) {
    console.error("Error fetching product detail:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// --- SITEMAP.XML ---
exports.getSitemap = async (req, res) => {
  try {
    const db = req.app.locals.db;
    const baseUrl = process.env.BASE_URL || 'https://onlyfreds.fun';

    // 1. Static Routes
    const urls = [
      { loc: '/', changefreq: 'daily', priority: 1.0 },
      { loc: '/products', changefreq: 'daily', priority: 0.8 },
      { loc: '/about', changefreq: 'monthly', priority: 0.6 },
      { loc: '/contact', changefreq: 'monthly', priority: 0.6 },
      { loc: '/terms', changefreq: 'yearly', priority: 0.3 },
      { loc: '/privacy', changefreq: 'yearly', priority: 0.3 },
      { loc: '/auth/login', changefreq: 'monthly', priority: 0.4 },
      { loc: '/auth/register', changefreq: 'monthly', priority: 0.4 },
    ];

    // 2. Categories
    const categories = await db.collection("categories").find().toArray();
    categories.forEach(cat => {
      urls.push({
        loc: `/products?category=${cat.categoryId}`,
        changefreq: 'weekly',
        priority: 0.7
      });
    });

    // 3. Products
    const products = await db.collection("products").find().toArray();
    products.forEach(prod => {
      urls.push({
        loc: `/product/${prod.productId}`,
        changefreq: 'weekly',
        priority: 0.8
      });
    });

    // 4. Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach(url => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${url.loc}</loc>\n`;
      xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      xml += `    <priority>${url.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'text/xml'); // Changed to text/xml for better compatibility
    res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).end();
  }
};

// --- ROBOTS.TXT ---
exports.getRobots = (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://www.onlyfreds.fun';
const content = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /auth/verify/
Disallow: /auth/reset/
Disallow: /auth/logout
Sitemap: ${baseUrl}/sitemap.xml`;

  res.type('text/plain');
  res.send(content);
};