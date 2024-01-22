/* eslint-disable arrow-body-style */
// crypto is a built-in nodejs module
const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please tell us your email address!'],
    unique: true,
    // Convert the email string to lowercase
    lowercase: true,
    validate: {
      validator: validator.isEmail,
      message: 'Please enter a valid email address!',
    },
  },
  photo: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
    validate: {
      validator: function (ele) {
        console.log(this.rolePassword, ele);
        return ele === 'user' || this.rolePassword === 'rolePassword';
      },
      message:
        'Role password wrong! Please input the correct password to set your role.',
    },
  },
  rolePassword: {
    type: String,
    select: false,
  },
  password: {
    type: String,
    required: [true, 'Please set your password!'],
    minLength: 8,
    // Never show the password in any output
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password!'],
    validate: {
      //! This only works on .create() and .save()!!!
      validator: function (ele) {
        // Check if user inputs the same password
        return ele === this.password;
      },
      message: 'Please enter the same password!',
    },
  },
  passwordChangedAt: {
    type: Date,
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    // Won't show this field
    select: false,
  },
});

// Hash(Encrypt) the password before save the user document into the database
userSchema.pre('save', async function (next) {
  // .isModified('password) will only return true if you are changing the password.
  if (!this.isModified('password')) return next();

  // Hash(encrypt) the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // Delete passwordConfirm from database
  this.passwordConfirm = undefined;
  next();
});

// Update the password changed time
userSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next();

  //! For some reason, the 'passwordChangedAt' is created later than time when JWT token is issued,
  // and which will cause 'Error: User recently changed password! Please login again.'
  // To prevent that, I minus 'passwordChangedAt' by 10 sec
  this.passwordChangedAt = Date.now() - 10000;
  next();
});

// When finding user documents, set 'active' field invisible
userSchema.pre(/^find/, function (next) {
  // 'this' refers to the current query object in mongoose
  this.find({ active: { $ne: false } });
  next();
});

// Create an instance method by format of 'schema.methods.functionName()',
// then it will become available on all the user documents
userSchema.methods.verifyPassword = async (candidatePassword, userPassword) => {
  // Compare the original password the user inputted with the encrypted password stored in the database
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.isPasswordChanged = function (JWTTimestamp) {
  // If user used to changed the password
  if (this.passwordChangedAt) {
    // Convert the date the user changed the password to timestamp
    const changedTimestamp = this.passwordChangedAt.getTime() / 1000;
    // If user changed the password after the token was issued, return true
    return JWTTimestamp < changedTimestamp;
  }

  // If password haven't changed before, return false
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // Create a reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Encrypt the reset token, and store it in the database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Reset token will be expired in 10 min
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return the unencrypted token back
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
