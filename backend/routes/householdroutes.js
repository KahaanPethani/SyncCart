const express = require('express');
const router = express.Router();
const Household = require('../models/Household');
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

// Helper function to generate a random 6-character uppercase join code
const generateJoinCode = () => {
  return 'CART-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 1. POST /api/households/create - Create a new household
router.post('/create', protect, async (req, res) => {
  try {
    const { name } = req.body;

    // Check if user is already in a household
    if (req.user.householdId) {
      return res.status(400).json({ error: 'User is already part of a household' });
    }

    const joinCode = generateJoinCode();

    // Create household with the logged-in user as admin and initial member
    const household = await Household.create({
      name,
      joinCode,
      admin: req.user._id,
      members: [req.user._id],
    });

    // Update user record with householdId and admin role
    req.user.householdId = household._id;
    req.user.role = 'admin';
    await req.user.save();

    res.status(201).json(household);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /api/households/join - Join an existing household via join code
router.post('/join', protect, async (req, res) => {
  try {
    const { joinCode } = req.body;

    if (req.user.householdId) {
      return res.status(400).json({ error: 'User is already part of a household' });
    }

    // Find household by uppercase join code
    const household = await Household.findOne({
      joinCode: joinCode.trim().toUpperCase(),
    });

    if (!household) {
      return res.status(404).json({ error: 'Invalid join code. Household not found.' });
    }

    // Add user to household's members array
    household.members.push(req.user._id);
    await household.save();

    // Update user record with householdId
    req.user.householdId = household._id;
    req.user.role = 'member';
    await req.user.save();

    res.status(200).json(household);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/households/my-household - Fetch current user's household details & members
router.get('/my-household', protect, async (req, res) => {
  try {
    if (!req.user.householdId) {
      return res.status(404).json({ error: 'User does not belong to any household' });
    }

    const household = await Household.findById(req.user.householdId)
      .populate('members', 'name email role')
      .populate('admin', 'name email');

    res.status(200).json(household);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;