const { v4: uuidv4 } = require("uuid");

// List Users with Analytics
exports.getUsers = async (req, res) => {
  const db = req.app.locals.db;

  try {
    // 1. Fetch all non-admin users
    const users = await db.collection("users")
      .find({ role: { $ne: "admin" } })
      .toArray();

    // 2. Fetch order stats per user
    const orders = await db.collection("orders").find().toArray();

    const usersWithStats = users.map(user => {
      const userOrders = orders.filter(o => o.userId === user.userId);
      const totalOrders = userOrders.length;
      const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      
      return {
        ...user,
        totalOrders,
        totalSpent
      };
    });

    res.render("dashboard/users/index", {
      user: req.session.user,
      users: usersWithStats,
      success: req.query.success || null,
      error: req.query.error || null
    });

  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).render("500", { title: "Server Error" });
  }
};

// Ban User
exports.banUser = async (req, res) => {
  const db = req.app.locals.db;
  const { userId, reason, duration, customDuration } = req.body;

  try {
    let expiresAt = null;

    // Calculate Expiry
    if (duration === "permanent") {
        expiresAt = new Date('9999-12-31');
    } else {
        let daysToAdd = 0;
        
        if (duration === "custom") {
            daysToAdd = parseInt(customDuration);
        } else {
            daysToAdd = parseInt(duration);
        }

        if (!isNaN(daysToAdd) && daysToAdd > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + daysToAdd);
        } else {
            // Fallback to permanent if input is invalid
            expiresAt = new Date('9999-12-31');
        }
    }

    await db.collection("users").updateOne(
        { userId },
        { 
            $set: { 
                accountStatus: "banned",
                banDetails: {
                    reason: reason || "Violation of Terms",
                    bannedAt: new Date(),
                    expiresAt: expiresAt
                }
            }
        }
    );

    res.redirect("/dashboard/admin/users?success=User banned successfully");
  } catch (err) {
    console.error("Ban error:", err);
    res.redirect("/dashboard/admin/users?error=Failed to ban user");
  }
};

// Unban User
exports.unbanUser = async (req, res) => {
    const db = req.app.locals.db;
    const { userId } = req.body;
  
    try {
      await db.collection("users").updateOne(
          { userId },
          { 
              $set: { accountStatus: "active" },
              $unset: { banDetails: "" }
          }
      );
  
      res.redirect("/dashboard/admin/users?success=User unbanned successfully");
    } catch (err) {
      console.error("Unban error:", err);
      res.redirect("/dashboard/admin/users?error=Failed to unban user");
    }
};