// src/controllers/cartController.js
const { v4: uuidv4 } = require("uuid");

// GET /cart
exports.getCart = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;

  try {
    const cartDoc = await db.collection("carts").findOne({ userId: user.userId });
    const cartItems = cartDoc ? cartDoc.items : [];
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.render("cart", {
      user: user,
      cart: cartItems,
      total,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// POST /cart/add
exports.addToCart = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const { productId, variant, quantity } = req.body;
  const qty = parseInt(quantity) || 1;

  try {
    const product = await db.collection("products").findOne({ productId });
    if (!product) return res.redirect("/products");

    let price = product.price;
    let name = product.name;
    if (variant && product.variants) {
      const v = product.variants.find(v => v.name === variant);
      if (v) {
        price = v.price;
        name = `${product.name} (${variant})`;
      }
    }

    const newItem = {
      productId,
      name,
      price,
      imgUrl: product.imgUrl,
      variant: variant || null,
      quantity: qty
    };

    const cart = await db.collection("carts").findOne({ userId: user.userId });

    if (!cart) {
      await db.collection("carts").insertOne({
        userId: user.userId,
        items: [newItem],
        updatedAt: new Date()
      });
    } else {
      const itemIndex = cart.items.findIndex(
        i => i.productId === productId && i.variant === (variant || null)
      );

      if (itemIndex > -1) {
        await db.collection("carts").updateOne(
          { userId: user.userId, "items.productId": productId, "items.variant": variant || null },
          { 
            $inc: { "items.$.quantity": qty },
            $set: { updatedAt: new Date() }
          }
        );
      } else {
        await db.collection("carts").updateOne(
          { userId: user.userId },
          { 
            $push: { items: newItem },
            $set: { updatedAt: new Date() }
          }
        );
      }
    }

    // SUCCESS: Redirect back to product page with 'added=true'
    res.redirect(`/product/${productId}?added=true`);

  } catch (err) {
    console.error("Add to cart error:", err);
    // ERROR: Redirect back to product page with error message
    res.redirect(`/product/${productId}?error=Could not add item to cart`);
  }
};

// POST /cart/update
exports.updateCart = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const { productId, variant, quantity } = req.body;
  const newQty = parseInt(quantity);

  if (newQty < 1) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ error: "Invalid quantity" });
    }
    return res.redirect("/cart");
  }

  try {
    await db.collection("carts").updateOne(
      { userId: user.userId, "items.productId": productId, "items.variant": variant || null },
      { 
        $set: { "items.$.quantity": newQty, updatedAt: new Date() }
      }
    );

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ success: true, message: "Cart updated" });
    }

    res.redirect("/cart?success=Cart updated");
  } catch (err) {
    console.error("Update cart error:", err);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(500).json({ error: "Update failed" });
    }
    res.redirect("/cart?error=Update failed");
  }
};

// POST /cart/remove
exports.removeFromCart = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const { productId, variant } = req.body;

  try {
    await db.collection("carts").updateOne(
      { userId: user.userId },
      { 
        $pull: { items: { productId: productId, variant: variant || null } },
        $set: { updatedAt: new Date() }
      }
    );
    res.redirect("/cart?success=Item removed");
  } catch (err) {
    console.error("Remove cart error:", err);
    res.redirect("/cart?error=Remove failed");
  }
};