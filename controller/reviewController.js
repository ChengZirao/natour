const catchAsync = require('../utils/catchAsync');
const Review = require('../models/reviewModel');
const factory = require('./handlerFactory');

exports.getAllReviews = factory.getAll(Review);

exports.setTourAndUserId = (req, res, next) => {
  // Get the tour id the user wrote review to from /:tourId
  if (!req.body.tour) req.body.tour = req.params.tourId;
  // Get the user id from logged in user by his JWT token
  if (!req.body.user) req.body.user = req.user._id;
  next();
};

// POST api/v1/tours/:tourId/reviews
exports.createReview = factory.createOne(Review);

exports.updateReview = factory.updateOne(Review);

exports.deleteReview = factory.deleteOne(Review);

exports.getReview = factory.getOne(Review);
