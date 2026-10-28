const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // DEBUG LOGS — Remove later
      console.log('🔑 JWT Secret in memory:', process.env.JWT_SECRET);
      console.log('📦 Token received:', token);

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ error: 'User no longer exists' });
      }

      next();
    } catch (error) {
      console.error('❌ Token Verification Error:', error.message); // Prints exact reason in terminal
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }
};

module.exports = protect;