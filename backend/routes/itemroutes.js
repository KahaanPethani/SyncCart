const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const protect = require('../middleware/authMiddleware');

// Middleware to ensure user belongs to a household before accessing items
const requireHousehold = (req, res, next) => {
  if (!req.user.householdId) {
    return res.status(400).json({ error: 'User must belong to a household' });
  }
  next();
};

// 1. POST /api/items - Create a new item
router.post('/', protect, requireHousehold, async (req, res) => {
  try {
    const { name, quantity, category, status } = req.body;

    const newItem = await Item.create({
      name,
      quantity: quantity || 1,
      category: category || 'Other',
      status: status || 'cart',
      householdId: req.user.householdId,
      addedBy: req.user._id,
    });

    // Real-Time Sync: Emit event to household's Socket.io room
    const io = req.app.get('socketio');
    if (io) {
      io.to(req.user.householdId.toString()).emit('ITEM_ADDED', newItem);
    }

    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/items - Fetch all items for user's household ordered by creation date
router.get('/', protect, requireHousehold, async (req, res) => {
  try {
    const items = await Item.find({ householdId: req.user.householdId }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PATCH /api/items/:id/status - Update status or partially buy items
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, boughtQuantity } = req.body;
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const householdId = item.householdId 
      ? item.householdId.toString() 
      : req.user.householdId?.toString();

    if (!householdId) {
      return res.status(400).json({ error: 'Household context missing' });
    }

    const io = req.app.get('socketio');
    const parsedBoughtQty = parseInt(boughtQuantity, 10);

    // SCENARIO 1: Partial buy (Split quantity)
    if (status === 'pantry' && !isNaN(parsedBoughtQty) && parsedBoughtQty > 0 && parsedBoughtQty < item.quantity) {
      // 1. Deduct quantity from original cart item
      item.quantity -= parsedBoughtQty;
      if (!item.householdId) item.householdId = householdId;
      await item.save();

      // 2. Create new item in pantry with bought quantity
      const pantryItem = await Item.create({
        name: item.name,
        quantity: parsedBoughtQty,
        category: item.category,
        status: 'pantry',
        householdId: householdId,
        addedBy: req.user._id,
      });

      // 3. Emit live socket updates to household room
      if (io) {
        io.to(householdId).emit('ITEM_UPDATED', item);
        io.to(householdId).emit('ITEM_ADDED', pantryItem);
      }

      return res.json({
        split: true,
        updatedCartItem: item,
        newPantryItem: pantryItem,
      });
    }

    // SCENARIO 2: Full buy or Moving back to cart
    item.status = status;
    if (!item.householdId) item.householdId = householdId;
    await item.save();

    if (io) {
      io.to(householdId).emit('ITEM_UPDATED', item);
    }

    return res.json({
      split: false,
      item,
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({ error: error.message || 'Failed to update item' });
  }
});

// 4. DELETE /api/items/:id - Delete an item
router.delete('/:id', protect, requireHousehold, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({
      _id: req.params.id,
      householdId: req.user.householdId,
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found in your household' });
    }

    // Real-Time Sync: Emit event to household's Socket.io room
    const io = req.app.get('socketio');
    if (io) {
      io.to(req.user.householdId.toString()).emit('ITEM_DELETED', { itemId: req.params.id });
    }

    res.status(200).json({ message: 'Item deleted successfully', itemId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;