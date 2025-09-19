exports.getCustomerDashboard = (req, res) => {
  const user = req.session.user;
  res.render("dashboard/customer", {
    user
  });
};

exports.getAdminDashboard = async (req, res) => {
  const user = req.session.user;
  if (user.role !== "admin") {
    return res.redirect("/dashboard");
  }

  const db = req.app.locals.db;
  const users = await db.collection("users").find().toArray();

  res.render("dashboard/admin", {
    user,
    users
  });
};
