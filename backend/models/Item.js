const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    category: {
      type: String,
      default: 'Produce',
    },
    status: {
      type: String,
      enum: ['cart', 'pantry'],
      default: 'cart',
    },
    // REQUIRED: Ensures schema field matches 'householdId'
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);