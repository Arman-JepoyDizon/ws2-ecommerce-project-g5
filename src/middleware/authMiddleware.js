exports.ensureAuth = (req, res, next) => {
  if (!req.session.user) {
    let errorMessage = "Please log in to view this page.";

    // Check the requested URL to customize the message
    if (req.originalUrl.includes("/cart/add")) {
      errorMessage = "Please log in to add items to your cart.";
    } else if (req.originalUrl.includes("/cart")) {
      errorMessage = "Please log in to view your cart.";
    } else if (req.originalUrl.includes("/dashboard")) {
      errorMessage = "Please log in to access your dashboard.";
    }

    // Redirect with the dynamic error message
    return res.redirect(`/auth/login?error=${encodeURIComponent(errorMessage)}`);
  }
  next();
};

exports.ensureAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Access Denied");
  }
  next();
};