const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Household name is required'],
      trim: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Household', householdSchema);