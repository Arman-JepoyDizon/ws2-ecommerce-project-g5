exports.getIndex = (req, res) => {
  res.render("index", { user: req.session.user || null });
};

exports.getProducts = (req, res) => {
  res.render("products", { user: req.session.user || null });
};

exports.getAbout = (req, res) => {
  res.render("about", { user: req.session.user || null });
};

exports.getContact = (req, res) => {
  res.render("contact", { user: req.session.user || null });
};

exports.getTerms = (req, res) => {
  res.render("terms", { user: req.session.user || null });
};

exports.getPrivacy = (req, res) => {
  res.render("privacy", { user: req.session.user || null });
};


exports.getIndex = (req, res) => {
  const freddyProducts = [
    {
      name: "Classic Freddy Fazbear",
      description: "The OG Fred that started it all. Smells like pizza grease.",
      price: 9.99,
      imgUrl: "https://i.redd.it/01i6vsviasxa1.png"
    },
    {
      name: "Golden Freddy",
      description: "He stares into your soul and your wallet.",
      price: 19.99,
      imgUrl: "https://wallpapers.com/images/hd/golden-freddy-1511-x-2859-wallpaper-jrludndlrlhve7i0.jpg"
    },
    {
      name: "Toy Freddy",
      description: "Now with 20% more plastic and 200% more nightmares.",
      price: 14.99,
      imgUrl: "https://www.pikpng.com/pngl/b/262-2622993_toy-freddy-png-toy-freddy-fnaf-png-clipart.png"
    },
    {
      name: "Rock Star Freddy",
      description: "Will rock the living hell out of you.",
      price: 12.49,
      imgUrl: "https://preview.redd.it/im-really-into-the-theory-that-rockstar-freddy-was-modeled-v0-w6hbd88euwac1.png?width=640&crop=smart&auto=webp&s=46da745f63acce55209b6df876a565c177793f07"
    },
    {
      name: "Nightmare Freddy",
      description: "Guaranteed to ruin your sleep schedule.",
      price: 24.99,
      imgUrl: "https://wallpapers.com/images/hd/nightmare-freddy-f-n-a-f-character-4zuzfe4wl33nqsvi.png",
    },
    {
      name: "Funtime Freddy",
      description: "Comes with his bestie Bon-Bon. Batteries not included.",
      price: 29.99,
      imgUrl: "https://www.pngkey.com/png/full/226-2263809_funtime-freddy-five-nights-at-freddys.png",
    }
  ];

  res.render("index", {
    user: req.session.user || null,
    freddyProducts
  });
};