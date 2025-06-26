// backend/server.js
const port = 5000;
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
require('dotenv').config();
const bcrypt = require('bcrypt');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/dressmart', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Basic test route
app.get('/', (req, res) => {
  res.send('Dressmart Backend Running');
});

// Serve static images
app.use('/images', express.static(path.join(__dirname, 'upload/images')));

// === PRODUCT MODEL ===
const productSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: ['men', 'women', 'kids'] },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  image: { type: String, required: true },
  new_price: { type: Number, required: true, min: 0 },
  old_price: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  colors: { type: [String], required: true, default: ["Black"] },
  sizes: { type: [String], required: true, default: ["M"] },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true },
});

const Product = mongoose.model('Product', productSchema);

// === ADD PRODUCT ===
app.post('/addproduct', async (req, res) => {
  try {
    const {
      name,
      category,
      subcategory,
      image,
      new_price,
      old_price,
      stock,
      colors,
      sizes,
      available,
      gender
    } = req.body;

    if (!name || !category || !subcategory || !image || new_price === undefined || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields including gender'
      });
    }

    const normalizedGender = gender.toLowerCase();
    if (!['men', 'women', 'kids'].includes(normalizedGender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender value. Allowed values are men, women, kids.'
      });
    }

    const latestProduct = await Product.findOne().sort({ id: -1 });
    const newId = latestProduct ? latestProduct.id + 1 : 1;

    // Parse colors
    let colorArr = [];
    if (typeof colors === 'string') {
      try {
        colorArr = JSON.parse(colors);
        if (!Array.isArray(colorArr)) colorArr = [colorArr];
      } catch {
        colorArr = [colors];
      }
    } else if (Array.isArray(colors)) {
      colorArr = colors;
    } else {
      colorArr = ["Black"];
    }

    // Parse sizes
    let sizeArr = [];
    if (typeof sizes === 'string') {
      try {
        sizeArr = JSON.parse(sizes);
        if (!Array.isArray(sizeArr)) sizeArr = [sizeArr];
      } catch {
        sizeArr = [sizes];
      }
    } else if (Array.isArray(sizes)) {
      sizeArr = sizes;
    } else {
      sizeArr = ["M"];
    }

    const productData = {
      id: newId,
      name,
      gender: normalizedGender,
      category,
      subcategory,
      image,
      new_price: Number(new_price),
      old_price: old_price ? Number(old_price) : null,
      stock: stock ? Number(stock) : 0,
      colors: colorArr,
      sizes: sizeArr,
      available: available !== undefined ? available : true,
    };

    const product = new Product(productData);
    await product.save();

    const savedProduct = await Product.findById(product._id);
    res.json({
      success: true,
      product: savedProduct
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product',
      error: error.message
    });
  }
});

// === GET ALL PRODUCTS ===
app.get('/allproducts', async (req, res) => {
  try {
    const products = await Product.find({}).lean();

    const completeProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      gender: product.gender,
      category: product.category,
      subcategory: product.subcategory,
      image: product.image,
      new_price: product.new_price,
      old_price: product.old_price || null,
      stock: product.stock || 0,
      colors: product.colors || ["Black"],
      sizes: product.sizes || ["M"],
      date: product.date,
      available: product.available !== undefined ? product.available : true,
      _id: product._id,
      __v: product.__v
    }));

    res.json(completeProducts);
  } catch (err) {
    console.error('Get all products error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: err.message
    });
  }
});

app.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const completeProduct = {
      id: product._id, // or a separate product.id if exists
      name: product.name,
      gender: product.gender,
      category: product.category,
      subcategory: product.subcategory,
      image: product.image,
      new_price: product.new_price,
      old_price: product.old_price || null,
      stock: product.stock || 0,
      colors: product.colors || ["Black"],
      sizes: product.sizes || ["M"],
      date: product.date,
      available: product.available !== undefined ? product.available : true,
      _id: product._id,
      __v: product.__v
    };

    res.json({
      success: true,
      product: completeProduct
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: err.message
    });
  }
});

// === REMOVE PRODUCT ===
app.post('/removeproduct', async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.body.id });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove product error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove product' });
  }
});

// === USER MODEL ===
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  discount: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// === SIGNUP ===
app.post('/signup', async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(400).json({ success: false, message: 'User already exists' });

    const cart = {};
    for (let i = 0; i < 300; i++) cart[i] = 0;

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({ ...req.body, password: hashedPassword, cartData: cart });
    await user.save();

    const token = jwt.sign({ user: { id: user._id } }, 'secret_dressmart');
    res.json({ success: true, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Failed to signup' });
  }
});

// === LOGIN ===
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ success: false, message: 'Invalid credentials' });

    const validPass = await bcrypt.compare(req.body.password, user.password);
    if (!validPass) return res.json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ user: { id: user._id } }, 'secret_dressmart');
    res.json({ success: true, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Failed to login' });
  }
});

// === AUTH MIDDLEWARE ===
const fetchUser = (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const data = jwt.verify(token, 'secret_dressmart');
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// === CART ROUTES ===
app.post('/addtocart', fetchUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.cartData) user.cartData = {};
    user.cartData[req.body.itemId] = (user.cartData[req.body.itemId] || 0) + 1;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/removefromcart', fetchUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.cartData && user.cartData[req.body.itemId] > 0) {
      user.cartData[req.body.itemId] -= 1;
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/updatecartquantity', fetchUser, async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    const user = await User.findById(req.user.id);
    if (quantity < 1) return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });

    user.cartData[itemId] = quantity;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Update cart quantity error:', err);
    res.status(500).json({ success: false });
  }
});

const promoCodes = {
  SAVE10: 10,
  OFF20: 20,
  DRESS5: 5,
};

app.post('/applydiscount', fetchUser, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    const amount = promoCodes[code.toUpperCase()];

    if (!amount) return res.status(400).json({ success: false, message: 'Invalid promo code' });

    user.discount = amount;
    await user.save();

    res.json({ success: true, discount: amount });
  } catch (err) {
    console.error('Apply discount error:', err);
    res.status(500).json({ success: false });
  }
});

app.get('/getcartsummary', fetchUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const cart = user.cartData || {};

    const productIds = Object.keys(cart);
    const products = await Product.find({ id: { $in: productIds.map(Number) } });

    let cartTotalAmount = 0;
    let cartTotalItems = 0;

    products.forEach(product => {
      const qty = cart[product.id] || 0;
      cartTotalAmount += product.new_price * qty;
      cartTotalItems += qty;
    });

    res.json({
      cartTotalAmount: cartTotalAmount.toFixed(2),
      cartTotalItems,
      discountApplied: user.discount || 0
    });
  } catch (err) {
    console.error('Cart summary error:', err);
    res.status(500).json({ success: false });
  }
});

// === ADMIN MODEL ===
const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
});

const Admin = mongoose.model('Admin', adminSchema);

// === ADMIN REGISTRATION ===
app.post('/register-admin', async (req, res) => {
  try {
    if (await Admin.findOne()) return res.status(400).json({ success: false, message: 'Admin already exists' });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await new Admin({ email: req.body.email, password: hashedPassword }).save();
    res.json({ success: true });
  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ success: false, message: 'Failed to register admin' });
  }
});

// === ADMIN LOGIN ===
app.post('/admin/login', async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.body.email });
    if (!admin) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const validPass = await bcrypt.compare(req.body.password, admin.password);
    if (!validPass) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ admin: { id: admin._id } }, 'secret_dressmart');
    res.json({ success: true, token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Failed to login' });
  }
});

// === ORDER MODEL ===
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: Number,
    },
  ],
  totalAmount: Number,
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending' },
});

const Order = mongoose.model('Order', orderSchema);

// === PLACE ORDER ===
app.post('/order', fetchUser, async (req, res) => {
  try {
    const { items, totalAmount } = req.body;
    if (!items || totalAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid order data' });

    const order = new Order({ user: req.user.id, items, totalAmount });
    await order.save();

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
});

// === GET USER ORDERS ===
app.get('/myorders', fetchUser, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('items.productId', 'name image');
    res.json({ success: true, orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// === UPLOAD ROUTE ===
app.post('/upload', (req, res) => {
  if (!req.files || !req.files.product) {
    return res.status(400).json({ success: 0, message: 'No file uploaded' });
  }

  const file = req.files.product;
  const uploadDir = path.join(__dirname, 'upload/images');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${Date.now()}_${file.name}`;
  const uploadPath = path.join(uploadDir, fileName);

  file.mv(uploadPath, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ success: 0, message: 'Failed to upload file' });
    }
    res.json({ success: 1, image_url: `http://localhost:${port}/images/${fileName}` });
  });
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));
