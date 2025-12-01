// src/controllers/orderController.js
const { v4: uuidv4 } = require("uuid");

// POST /orders/checkout
exports.postCheckout = async (req, res) => {
  const db = req.app.locals.db;
  const ordersCollection = db.collection("orders");
  const cartsCollection = db.collection("carts");
  const user = req.session.user;
  
  // selectedItems will be an array of strings in format: "productId|variant"
  // (We use a pipe | or similar separator to be safe)
  let { selectedItems } = req.body;

  if (!selectedItems) {
    return res.redirect("/cart?error=Please select items to checkout.");
  }

  // Ensure it's an array (if only 1 item selected, express might send a string)
  if (!Array.isArray(selectedItems)) {
    selectedItems = [selectedItems];
  }

  try {
    // 1. Fetch user's cart
    const cartDoc = await cartsCollection.findOne({ userId: user.userId });
    if (!cartDoc || !cartDoc.items || cartDoc.items.length === 0) {
      return res.redirect("/cart?error=Your cart is empty.");
    }

    // 2. Filter items that match the selection
    const itemsToOrder = [];
    const itemsToKeep = [];

    cartDoc.items.forEach(item => {
      // Construct key to match checkbox value
      const key = `${item.productId}|${item.variant || ''}`;
      
      if (selectedItems.includes(key)) {
        // Calculate subtotal
        item.subtotal = item.price * item.quantity;
        itemsToOrder.push(item);
      } else {
        itemsToKeep.push(item);
      }
    });

    if (itemsToOrder.length === 0) {
      return res.redirect("/cart?error=Invalid selection.");
    }

    // 3. Compute Total
    const totalAmount = itemsToOrder.reduce((sum, item) => sum + item.subtotal, 0);

    // 4. Create Order
    const newOrder = {
      orderId: uuidv4(),
      userId: user.userId,
      items: itemsToOrder,
      totalAmount: totalAmount,
      orderStatus: "to_pay",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await ordersCollection.insertOne(newOrder);

    // 5. Update Cart (Remove ordered items)
    await cartsCollection.updateOne(
      { userId: user.userId },
      { $set: { items: itemsToKeep, updatedAt: new Date() } }
    );

    // 6. Redirect
    if (user.role === 'admin') {
        res.redirect("/dashboard/admin/orders?success=Order placed successfully");
    } else {
        res.redirect("/dashboard/customer?success=Order placed successfully");
    }

  } catch (err) {
    console.error("Checkout error:", err);
    res.redirect("/cart?error=Checkout failed");
  }
};