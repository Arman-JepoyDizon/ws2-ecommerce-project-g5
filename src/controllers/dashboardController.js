// GET /dashboard/customer
exports.getCustomerDashboard = async (req, res) => {
  const user = req.session.user;
  const db = req.app.locals.db;
  const ordersCollection = db.collection("orders");

  try {
    // 1. Fetch all orders for this user
    const userOrders = await ordersCollection
      .find({ userId: user.userId })
      .toArray();

    // 2. Calculate Counts per Status
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