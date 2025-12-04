// src/controllers/dashboardController.js

// Helper: Get start of day in PH Time converted to UTC Date object
function getPHStartOfDay(dateString) {
    // dateString is "YYYY-MM-DD"
    // We construct a string explicitly for PH timezone: "YYYY-MM-DDT00:00:00+08:00"
    return new Date(`${dateString}T00:00:00+08:00`);
}

// Helper: Get end of day in PH Time converted to UTC Date object
function getPHEndOfDay(dateString) {
    // We construct "YYYY-MM-DDT23:59:59.999+08:00"
    return new Date(`${dateString}T23:59:59.999+08:00`);
}

// Helper: Convert a Date object to "YYYY-MM-DD" string in PH Time
function formatToPHDateString(dateObj) {
    return dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); 
    // en-CA gives YYYY-MM-DD format automatically
}

// Customer Dashboard
exports.getCustomerDashboard = async (req, res) => {
  const user = req.session.user;
  const db = req.app.locals.db;
  const ordersCollection = db.collection("orders");

  try {
    const userOrders = await ordersCollection
      .find({ userId: user.userId })
      .toArray();

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

// Admin Dashboard (UPDATED WITH PH TIMEZONE FIX)
exports.getAdminDashboard = async (req, res) => {
  const user = req.session.user;
  if (user.role !== "admin") {
    return res.redirect("/dashboard/customer");
  }

  const db = req.app.locals.db;
  
  // 1. Date Filter Logic (Single Input)
  let { dateRange } = req.query;
  let startDate, endDate;

  // Parse "YYYY-MM-DD to YYYY-MM-DD"
  if (dateRange) {
      const dates = dateRange.split(' to ');
      if (dates.length === 2) {
          startDate = dates[0];
          endDate = dates[1];
      } else {
          startDate = dates[0];
          endDate = dates[0]; // Handle single date selection
      }
  }
  
  // Default to last 30 days (PH Time) if not provided
  if (!startDate || !endDate) {
      const nowPH = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
      const end = new Date(nowPH);
      const start = new Date(nowPH);
      start.setDate(start.getDate() - 30);
      
      // Helper to format JS Date to YYYY-MM-DD manually or via en-CA
      const format = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      
      startDate = format(start);
      endDate = format(end);
      dateRange = `${startDate} to ${endDate}`;
  }

  // Create Date objects for MongoDB Query (Adjusted for PH Timezone)
  const startQuery = getPHStartOfDay(startDate);
  const endQuery = getPHEndOfDay(endDate);

  try {
    // 2. Fetch Filtered Orders (For Analytics)
    const query = {
        createdAt: {
            $gte: startQuery,
            $lte: endQuery
        }
    };
    
    const orders = await db.collection("orders").find(query).toArray();
    
    // 3. Fetch TODAY'S Sales (Independent Stat - PH Time)
    const nowPHString = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const startToday = getPHStartOfDay(nowPHString);
    const endToday = getPHEndOfDay(nowPHString);
    
    const todayOrders = await db.collection("orders").find({
        createdAt: { $gte: startToday, $lte: endToday }
    }).toArray();
    
    const dailySales = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // 4. Calculate General Stats (From Filtered Data)
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;

    // 5. Prepare Sales Line Chart
    const salesMap = {};
    
    // Pre-fill dates in the range with 0 so the graph doesn't have gaps
    // (Iterate from start to end date)
    let currentIterDate = new Date(startQuery);
    while (currentIterDate <= endQuery) {
        const dateStr = formatToPHDateString(currentIterDate);
        salesMap[dateStr] = 0;
        currentIterDate.setDate(currentIterDate.getDate() + 1);
    }

    orders.forEach(order => {
        if (order.createdAt) {
            // Convert order time to PH Date String key
            const dateStr = formatToPHDateString(order.createdAt);
            if (salesMap[dateStr] !== undefined) {
                salesMap[dateStr] += order.totalAmount;
            }
        }
    });
    const salesLabels = Object.keys(salesMap).sort();
    const salesValues = salesLabels.map(date => salesMap[date]);

    // 6. Prepare Product Stats
    const productStats = {};
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                if (!productStats[item.productId]) {
                    productStats[item.productId] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productStats[item.productId].quantity += item.quantity;
                productStats[item.productId].revenue += item.subtotal;
            });
        }
    });

    const productStatsArray = Object.values(productStats);
    const bestSellers = [...productStatsArray].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const productsSold = [...productStatsArray].sort((a, b) => b.revenue - a.revenue);

    // 7. Status Distribution
    const statusCounts = { to_pay: 0, to_ship: 0, to_receive: 0, completed: 0, cancelled: 0 };
    orders.forEach(order => {
        if (statusCounts[order.orderStatus] !== undefined) {
            statusCounts[order.orderStatus]++;
        }
    });

    res.render("dashboard/admin", {
      user,
      totalRevenue,
      totalOrders,
      dailySales,
      salesLabels,
      salesValues,
      statusValues: Object.values(statusCounts),
      bestSellers,
      productsSold,
      dateRange,
      success: req.query.success || null,
      error: req.query.error || null
    });

  } catch (err) {
    console.error("Error loading admin dashboard:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// Admin Orders List
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

// Admin Order Detail View
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

// Update Order Status
exports.updateOrderStatus = async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { orderStatus } = req.body;

  try {
    const now = new Date();
    const statusLabels = {
        to_pay: "To Pay", to_ship: "To Ship", to_receive: "To Receive", completed: "Completed"
    };

    await db.collection("orders").updateOne(
      { orderId: id },
      { 
        $set: { orderStatus: orderStatus, updatedAt: now },
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