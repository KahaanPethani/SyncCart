const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function to generate a JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// 1. POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists in MongoDB
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create user (password hashing is handled automatically by User.js pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        householdId: user.householdId,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ error: 'Invalid user data received' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /api/auth/login - Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email and explicitly include the password field for verification
    const user = await User.findOne({ email }).select('+password');

    // Verify password using instance method from User.js model
    if (user && (await user.matchPassword(password))) {
      res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        householdId: user.householdId,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;