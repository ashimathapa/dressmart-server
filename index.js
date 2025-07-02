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
const JWT_SECRET = process.env.JWT_SECRET;

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
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { id: isNaN(Number(id)) ? id : Number(id) }] }
      : { id: isNaN(Number(id)) ? id : Number(id) };

    const product = await Product.findOne(query).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const completeProduct = {
      id: product.id || product._id,
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

    res.json({ success: true, product: completeProduct });
  } catch (err) {
    console.error('Get product error:', err.message);
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

// 1. Update User Model to include roles
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: { type: Map, of: Number, default: {} },
  discount: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  roles: { type: [String], default: ['user'], enum: ['user', 'admin'] }
});

const User = mongoose.model('User', userSchema);
// === USER ROUTES ===
app.post('/signup', async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(400).json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const cart = {};
    for (let i = 0; i < 300; i++) cart[i] = 0;

    const user = new User({ ...req.body, password: hashedPassword, cartData: cart });
    await user.save();

    const token = jwt.sign({ user: { id: user._id } }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Failed to signup' });
  }
});

// app.post('/login', async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.body.email });
//     if (!user) return res.json({ success: false, message: 'Invalid credentials' });

//     const validPass = await bcrypt.compare(req.body.password, user.password);
//     if (!validPass) return res.json({ success: false, message: 'Invalid credentials' });

//     const token = jwt.sign({ user: { id: user._id } }, JWT_SECRET);
//     res.json({ success: true, token });
//   } catch (err) {
//     res.status(500).json({ success: false, message: 'Login failed' });
//   }
// });


// app.post('/register-admin', async (req, res) => {
//   try {
//     const { email, password } = req.body;
    
//     // Check if admin already exists
//     const existingAdmin = await User.findOne({ email, roles: 'admin' });
//     if (existingAdmin) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Admin already exists' 
//       });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const admin = new User({ 
//       email, 
//       password: hashedPassword,
//       roles: ['admin']
//     });

//     await admin.save();

//     res.json({ 
//       success: true,
//       message: 'Admin registered successfully'
//     });
//   } catch (err) {
//     console.error('Admin registration error:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to register admin',
//       error: err.message 
//     });
//   }
// });

// // 3. Improved Admin Login
// app.post('/admin/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Email and password are required' 
//       });
//     }

//     // Find user with admin role
//     const admin = await User.findOne({ 
//       email,
//       roles: { $in: ['admin'] } 
//     });

//     if (!admin) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Admin account not found' 
//       });
//     }

//     const validPass = await bcrypt.compare(password, admin.password);
//     if (!validPass) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Invalid credentials' 
//       });
//     }

//     const token = jwt.sign(
//       { 
//         user: { 
//           id: admin._id,
//           roles: admin.roles,
//           isAdmin: true 
//         } 
//       }, 
//       JWT_SECRET,
//       { expiresIn: '8h' }
//     );

//     res.json({ 
//       success: true, 
//       token,
//       user: {
//         id: admin._id,
//         email: admin.email,
//         roles: admin.roles
//       }
//     });
//   } catch (err) {
//     console.error('Admin login error:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Login failed',
//       error: err.message 
//     });
//   }
// });


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Verify password
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Create token with user roles
    const token = jwt.sign(
      { 
        user: { 
          id: user._id,
          roles: user.roles
        } 
      }, 
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        email: user.email,
        roles: user.roles
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: err.message 
    });
  }
});
app.post('/register', async (req, res) => {
  try {
    const { email, password, isAdmin } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const roles = isAdmin ? ['admin'] : ['user'];
    
    const newUser = new User({ 
      email, 
      password: hashedPassword,
      roles
    });

    await newUser.save();

    res.json({ 
      success: true,
      message: 'User registered successfully'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to register user',
      error: err.message 
    });
  }
});

// === AUTH MIDDLEWARE ===
const fetchUser = (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ error: 'Access denied. No token.' });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data.user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// app.post('/register-admin', async (req, res) => {
//   try {
//     const { email, password } = req.body;
    
//     // Check if admin already exists
//     const existingAdmin = await User.findOne({ email, roles: 'admin' });
//     if (existingAdmin) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Admin already exists' 
//       });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const admin = new User({ 
//       email, 
//       password: hashedPassword,
//       roles: ['admin']
//     });

//     await admin.save();

//     res.json({ 
//       success: true,
//       message: 'Admin registered successfully'
//     });
//   } catch (err) {
//     console.error('Admin registration error:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to register admin',
//       error: err.message 
//     });
//   }
// });

// // 3. Improved Admin Login
// app.post('/admin/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Email and password are required' 
//       });
//     }

//     // Find user with admin role
//     const admin = await User.findOne({ 
//       email,
//       roles: { $in: ['admin'] } 
//     });

//     if (!admin) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Admin account not found' 
//       });
//     }

//     const validPass = await bcrypt.compare(password, admin.password);
//     if (!validPass) {
//       return res.status(401).json({ 
//         success: false, 
//         message: 'Invalid credentials' 
//       });
//     }

//     const token = jwt.sign(
//       { 
//         user: { 
//           id: admin._id,
//           roles: admin.roles,
//           isAdmin: true 
//         } 
//       }, 
//       JWT_SECRET,
//       { expiresIn: '8h' }
//     );

//     res.json({ 
//       success: true, 
//       token,
//       user: {
//         id: admin._id,
//         email: admin.email,
//         roles: admin.roles
//       }
//     });
//   } catch (err) {
//     console.error('Admin login error:', err);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Login failed',
//       error: err.message 
//     });
//   }
// });

// 5. Admin-specific Middleware
// const requireAdmin = (req, res, next) => {
//   if (!req.user.roles.includes('admin')) {
//     return res.status(403).json({ 
//       success: false, 
//       message: 'Admin access required' 
//     });
//   }
//   next();
// };


// === AUTH MIDDLEWARE ===
const authenticateAdmin = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.roles.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Access denied: Not an admin' });
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
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



// === ADMIN USERS ENDPOINT ===
app.get('/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, cartData: 0, __v: 0 }).lean();
    res.json({
      status: 'success',
      data: {
        users: users.map(user => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles || ['user'],
          isActive: user.isActive !== false,
          createdAt: user.date
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});

// === USER ROLE UPDATE ===
app.put('/admin/users/:id/roles', authenticateAdmin, async (req, res) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ success: false, message: 'Roles must be an array' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { roles },
      { new: true, select: '-password -cartData' }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user roles' });
  }
});

// === TOGGLE USER STATUS ===
app.put('/admin/users/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive,
        date: user.date
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle user status' });
  }
});





// === ENHANCED ORDER MODEL ===
const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [
    {
      productId: { type: Number, required: true },
      name: { type: String, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true, min: 1 }
    }
  ],
  shippingInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true }
  },
  paymentInfo: {
    method: { type: String, required: true, enum: ['creditCard', 'cash'] },
    status: { type: String, default: 'Pending' },
    cardLast4: { type: String },
    cardExpiry: { type: String }
  },
  totalAmount: { type: Number, required: true },
  shippingFee: { type: Number, default: 100.00 },
  status: { 
    type: String, 
    default: 'Processing',
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled']
  },
  orderDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// === ENHANCED PLACE ORDER ENDPOINT ===
app.post('/placeorder', fetchUser, async (req, res) => {
  try {
    const { items, shippingInfo, paymentInfo, totalAmount } = req.body;
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order must contain at least one item' 
      });
    }

    if (!shippingInfo || !paymentInfo || totalAmount === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Validate shipping info
    const requiredShippingFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zipCode', 'country', 'phone'];
    for (const field of requiredShippingFields) {
      if (!shippingInfo[field]) {
        return res.status(400).json({ 
          success: false, 
          message: `Missing shipping field: ${field}` 
        });
      }
    }

    // Validate payment info
    if (!['creditCard', 'cash'].includes(paymentInfo.method)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment method' 
      });
    }

    if (paymentInfo.method === 'creditCard' && !paymentInfo.cardLast4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Card information required for credit card payment' 
      });
    }

    // Create order
    const order = new Order({
      user: req.user.id,
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity
      })),
      shippingInfo: {
        firstName: shippingInfo.firstName,
        lastName: shippingInfo.lastName,
        email: shippingInfo.email,
        address: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country,
        phone: shippingInfo.phone
      },
      paymentInfo: {
        method: paymentInfo.method,
        status: 'Pending',
        ...(paymentInfo.method === 'creditCard' && {
          cardLast4: paymentInfo.cardLast4,
          cardExpiry: paymentInfo.cardExpiry
        })
      },
      totalAmount: parseFloat(totalAmount),
      shippingFee: 100.00 // Fixed shipping fee as in frontend
    });

    await order.save();

    // Clear user's cart
    await User.updateOne(
      { _id: req.user.id },
      { $set: { cartData: {} } }
    );

    res.status(201).json({ 
      success: true, 
      orderId: order._id,
      message: 'Order placed successfully'
    });

  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to place order',
      error: err.message
    });
  }
});

// === GET ORDER DETAILS ===
app.get('/orders/:orderId', fetchUser, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user.id
    }).lean();

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Convert MongoDB ObjectId to string and format dates
    const formattedOrder = {
      ...order,
      _id: order._id.toString(),
      orderDate: new Date(order.orderDate).toISOString(),
      createdAt: new Date(order.createdAt).toISOString(),
      updatedAt: new Date(order.updatedAt).toISOString(),
      // Ensure items have proper IDs
      items: order.items.map(item => ({
        ...item,
        _id: item._id ? item._id.toString() : undefined
      }))
    };

    res.json({ 
      success: true, 
      order: formattedOrder 
    });

  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch order',
      error: err.message 
    });
  }
});




// === ADMIN ORDER ROUTES ===

// Get all orders (Admin only)
app.get('/admin/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    res.json({ 
      success: true, 
      orders: orders.map(order => ({
        ...order._doc,
        user: order.user ? {
          _id: order.user._id,
          name: order.user.name,
          email: order.user.email
        } : null
      }))
    });
  } catch (err) {
    console.error('Admin get orders error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders',
      error: err.message 
    });
  }
});

// Update order status (Admin only)
app.put('/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status value' 
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.json({ 
      success: true, 
      order: {
        ...order._doc,
        user: order.user ? {
          _id: order.user._id,
          name: order.user.name,
          email: order.user.email
        } : null
      }
    });
  } catch (err) {
    console.error('Admin update order status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order status',
      error: err.message 
    });
  }
});
const authenticateUser = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authorization token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Using the same secret as elsewhere
    const user = await User.findById(decoded.user?.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// 7. Add Token Verification Endpoint
app.get('/verify-token', (req, res) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    res.json({ user: verified.user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
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