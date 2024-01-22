const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty!'],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be above 1.0!'],
      max: [5, 'Rating must be below 5.0!'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour!'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user!'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// The combination of tour and user id should be unique, which means one user can only write one review on the same tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  // .populate({
  //   path: 'tour',
  //   select: 'name',
  // });
  next();
});

// Create static method on reviewModel
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // In STATIC method, 'this' key word points to the current Model(here is 'Review')
  // In order to call .aggregate(), have to create static method, this line of code is equal to 'Review.aggregate()'
  const stats = await this.aggregate([
    {
      // 1) Select reviews attach to this tour
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        numRating: { $sum: 1 },
        // Calculate the average rating of 'rating' field's value that attached to each selected tour
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  // If there are reviews on this tour, update 'ratingsQuantity' and 'ratingsAverage' of this tour document
  if (stats.length > 0) {
    // Update this tour with quantity and average of review
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].numRating,
      ratingsAverage: stats[0].avgRating,
    });
  } // If there's no review on this tour, set 'ratingsQuantity' and 'ratingsAverage' with default value
  else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// 1) Update average rating of this tour when create a new review on this tour
//* Use .post() middleware in order to calculate the avg ratings with the latest tour data
// In .post() middleware, there is no next() function
reviewSchema.post('save', function () {
  // 'this.contructor' refers to the Model who created this document(instance), here the Model is Review
  //! Why can't simply use 'Review.calcAverageRatings()'? Cuz 'Review' hasn't been declared at this point
  //! And we can't move this code after 'Review' declarating, cuz if so, the 'reviewSchema' will not contain this middleware!
  this.constructor.calcAverageRatings(this.tour);
});

reviewSchema.pre(/^findOneAnd/, async function (next) {
  // Get the review document and pass it to the .post(/^findOneAnd/) middleware
  // Here is a nice trick of passing the data: create a new key inside 'this' object, so that the value of this key will be reserved
  this.reviewDoc = await this.findOne();
  next();
});

// 2) Update average rating of this tour when update or delete a review on this tour
//! Can't code like 'save' middleware, cuz this one is a query middleware, 'this' refers to the query object rather than the review document being updated!
// findByIdAndUpdate(), findByIdAndDelete(), these two functions will trigger this middleware
reviewSchema.post(/^findOneAnd/, function () {
  //! 'this.reviewDoc = await this.findOne()' DOES NOT work here, cuz in .post(), the query('this') has already been executed!
  this.reviewDoc.constructor.calcAverageRatings(this.reviewDoc.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
