// src/controllers/dashboardController.js

// 1. Customer Dashboard
exports.getCustomerDashboard = async (req, res) => {
  const user = req.session.user;
  const db = req.app.locals.db;
  const ordersCollection = db.collection("orders");

  try {
    // Fetch all orders for this user
    const userOrders = await ordersCollection
      .find({ userId: user.userId })
      .toArray();

    // Calculate Counts per Status
    const statusCounts = {
      to_pay: 0,
      to_ship: 0,
      to_receive: 0,
      completed: 0,
      cancelled: 0,
      refund: 0
    };

    userOrders.forEach(order => {
      const status = order.orderStatus;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    res.render("dashboard/customer", {
      user,
      statusCounts,
      totalOrders: userOrders.length,
      success: req.query.success || null,
      error: req.query.error || null
    });

  } catch (err) {
    console.error("Error loading customer dashboard:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// 2. Admin Dashboard
exports.getAdminDashboard = async (req, res) => {
  const user = req.session.user;
  if (user.role !== "admin") {
    return res.redirect("/dashboard/customer");
  }

  const db = req.app.locals.db;
  const users = await db.collection("users").find().toArray();

  res.render("dashboard/admin", {
    user,
    users,
    success: req.query.success || null,
    error: req.query.error || null
  });
};

// 3. Admin Orders List
exports.getAdminOrders = async (req, res) => {
  const db = req.app.locals.db;
  const ordersCollection = db.collection("orders");
  const usersCollection = db.collection("users");

  try {
    const orders = await ordersCollection.find().sort({ createdAt: -1 }).toArray();
    const userIds = [...new Set(orders.map(order => order.userId))];
    const users = await usersCollection.find({ userId: { $in: userIds } }).toArray();

    const ordersWithUser = orders.map(order => {
      const user = users.find(u => u.userId === order.userId);
      return { ...order, userEmail: user ? user.email : "Unknown" };
    });

    res.render("dashboard/orders/index", {
      user: req.session.user,
      orders: ordersWithUser,
      success: req.query.success || null
    });

  } catch (err) {
    console.error("Error loading admin orders:", err);
    res.status(500).send("Error loading orders");
  }
};

// 4. Admin Order Detail View
exports.getAdminOrderDetail = async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  try {
    // Fetch Order
    const order = await db.collection("orders").findOne({ orderId: id });
    
    if (!order) {
        return res.redirect("/dashboard/admin/orders?error=Order not found");
    }

    // Fetch Customer Details
    const customer = await db.collection("users").findOne({ userId: order.userId });

    res.render("dashboard/orders/detail", {
      user: req.session.user, // The Admin
      customer: customer || {}, // The Buyer
      order,
      success: req.query.success || null,
      error: req.query.error || null
    });

  } catch (err) {
    console.error("Get order detail error:", err);
    res.status(500).send("Server Error");
  }
};

// 5. Update Order Status
exports.updateOrderStatus = async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { orderStatus } = req.body;

  try {
    const now = new Date();
    
    // Map status codes to readable labels
    const statusLabels = {
        to_pay: "To Pay",
        to_ship: "To Ship",
        to_receive: "To Receive",
        completed: "Completed"
    };

    await db.collection("orders").updateOne(
      { orderId: id },
      { 
        $set: { 
            orderStatus: orderStatus,
            updatedAt: now 
        },
        $push: {
            history: {
                status: orderStatus,
                label: `Status updated to ${statusLabels[orderStatus] || orderStatus}`,
                updatedBy: "Admin",
                timestamp: now
            }
        }
      }
    );

    res.redirect(`/dashboard/admin/orders/${id}?success=Status updated`);

  } catch (err) {
    console.error("Update status error:", err);
    res.redirect(`/dashboard/admin/orders/${id}?error=Failed to update status`);
  }
};