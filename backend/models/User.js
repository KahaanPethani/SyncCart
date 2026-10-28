const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Prevents password hash from being returned in standard queries
    },
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      default: null,
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'guest'],
      default: 'member',
    },
  },
  {
    timestamps: true,
  }
);

// Mongoose Middleware: Pre-save hook to hash password before saving to DB
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance Method: Compare input password with hashed password stored in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);