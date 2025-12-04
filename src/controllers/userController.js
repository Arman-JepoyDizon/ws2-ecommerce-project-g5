// src/controllers/userController.js

// GET /user/profile
exports.getProfile = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;

  try {
    // Fetch fresh user data
    const userData = await db.collection("users").findOne({ userId: user.userId });

    // FIX: Ensure 'name' property exists for the navbar to display correctly
    if (userData) {
        userData.name = userData.firstName;
    }

    res.render("dashboard/user/profile", {
      user: userData,
      success: req.query.updated ? "Profile updated successfully." : null
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// POST /user/profile (Update)
exports.updateProfile = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const { address, contactNumber } = req.body;

  try {
    await db.collection("users").updateOne(
      { userId: user.userId },
      { $set: { address, contactNumber, updatedAt: new Date() } }
    );

    res.redirect("/user/profile?updated=1");
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// GET /user/orders (Purchase History)
exports.getOrders = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;

  try {
    const orders = await db.collection("orders")
      .find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Group by status
    const ordersByStatus = {
      to_pay: [],
      to_ship: [],
      to_receive: [],
      completed: [],
      cancelled: [],
      refund: []
    };

    orders.forEach(order => {
      if (ordersByStatus[order.orderStatus]) {
        ordersByStatus[order.orderStatus].push(order);
      }
    });

    res.render("dashboard/user/orders", {
      user, // This uses req.session.user, so 'name' is already there
      ordersByStatus
    });
  } catch (err) {
    console.error("Get user orders error:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// POST /user/orders/:id/complete
exports.markOrderCompleted = async (req, res) => {
  const db = req.app.locals.db;
  const user = req.session.user;
  const { id } = req.params;

  try {
    const now = new Date();

    // Verify ownership
    const order = await db.collection("orders").findOne({ orderId: id, userId: user.userId });
    if (!order) return res.redirect("/user/orders");

    await db.collection("orders").updateOne(
      { orderId: id },
      { 
        $set: { 
            orderStatus: "completed", 
            updatedAt: now 
        },
        $push: {
            history: {
                status: "completed",
                label: "Order Received & Completed",
                updatedBy: "Customer",
                timestamp: now
            }
        }
      }
    );

    res.redirect("/user/orders?success=Order marked as completed");

  } catch (err) {
    console.error("Complete order error:", err);
    res.redirect("/user/orders?error=Failed to update order");
  }
};