/* eslint-disable prefer-destructuring */
/* eslint-disable arrow-body-style */
// Nodejs's built-in promisify function
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/sendEmail');

const createAndSendToken = (user, statusCode, res) => {
  // 1) Create token
  /**
   * Param 1: payload
   * Param 2: secret key, more than 32 character length is recommended
   * Param 3: optional settings, here I set jwt token expire time
   * Return: generated token, based on payload message, secret key and optional settings
   */
  // To decode the token, visit "https://jwt.io/"
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  // 2) Create cookie, store the JWT token into the cookie
  const cookieOptions = {
    // Cookie expire time should be aligned with jwt expire time
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 60 * 60 * 1000,
    ),
    // Cookie cannot be accessed or modified in any way by the browser, which can prevent cross-site scripting attack
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production')
    // Cookie will only be sent on an encrypted connection. E.g. https
    //! When setting to true, won't be worked at postman, so only in production mode that I will add this field
    cookieOptions.secure = true;

  /**
   * Param 1: name of the cookie
   * Param 2: data that want to send in the cookie
   * Param 3: optional settings
   */
  res.cookie('jwt', token, cookieOptions);

  // 3) Hide password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    rolePassword: req.body.rolePassword,
    role: req.body.role,
  });

  // After signing up, the user should be then log in automatically. So send user a token
  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  // Use '+' in .select() to show the field that is defaultly hidden
  const user = await User.findOne({ email: email }).select('+password');

  if (!user || !(await user.verifyPassword(password, user.password))) {
    // 401 means 'unauthorized'
    return next(new AppError('Incorrect email or password!', 401));
  }

  // If everything is ok, send token to the client
  createAndSendToken(user, 200, res);
});

// User is required to be logged in to have access to certain routes
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Get the token and check if it's exist
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }

  // 2) Verify token
  // jwt.verify() is an async function, with a callback function as the third parameter
  // So I use util.promisify(jwt.verify) to convert it to a promise function, which allows me to 'await' this function
  const decodedToken = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET,
  );

  // 3) Check if the user still exists
  const freshUser = await User.findById(decodedToken.id);
  if (!freshUser)
    return next(
      new AppError(
        'The user belonging to this token is no longer exists!',
        401,
      ),
    );

  // 4) Check if user changed password after token was issued
  // 'decodedToken.iat' is the timestamp when the JWT token was issued
  if (freshUser.isPasswordChanged(decodedToken.iat)) {
    return next(
      new AppError('User recently changed password! Please login again.'),
      401,
    );
  }

  // GRANT ACCESS TO THE PROTECTED ROUTE
  // Add this user info to req.user
  req.user = freshUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']
    if (!roles.includes(req.user.role))
      return next(
        new AppError('You do not have permission to perform this action!'),
        // 403 means 'Forbidden'
        403,
      );

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return next(new AppError('No user found with this Email address!', 404));

  // 2) Generate a random reset token
  // By using .createPasswordResetToken() function, the user here now have fields of 'passwordResetToken' and 'passwordResetExpires'
  const resetToken = user.createPasswordResetToken();

  // Update the user with two new fields 'passwordResetToken' and 'passwordResetExpires' to the database
  //! Before saving, deactivate the validation, or will cause error
  //! because now the user do not have 'passwordConfirm', and which is a required field!
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  // http://127.0.0.1:3000/api/v1/users/resetPassword/${resetToken}
  const resetURL = `${req.protocol}://${req.get(
    'host',
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}. \n\nIf you didn't forget your password, please ignore this Email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to Email!',
    });
  } catch (err) {
    // If have errors about sending email, delete passwordResetToken and passwordResetExpires from database
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the Email. Try again!', 500),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the reset token
  // Hash the original token again, so that will be the same as the encrypted token in the database
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) Check if the token has expired
  if (!user) return next(new AppError('Reset token has expired!', 400));

  // 3) If token is valid, reset the password and delete reset token and token expire time in the database
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4) Change 'passwordChangedAt', already did it at userSchema.pre()

  // 5) Log the user in, send JWT token
  createAndSendToken(user, 201, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user
  const user = await User.findById(req.user._id).select('+password');

  // 2) Check if the POSTed current password is correct
  if (!(await user.verifyPassword(req.body.passwordCurrent, user.password)))
    return next(
      new AppError('Incorrect current password! Please try again.', 401),
    );

  // 3) If current password is correct, update password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  await user.save();

  // 4) Log user in, send JWT token
  createAndSendToken(user, 201, res);
});
