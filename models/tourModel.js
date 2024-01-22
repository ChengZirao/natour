/* eslint-disable prefer-arrow-callback */
const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
const catchAsync = require('../utils/catchAsync');

const User = require('./userModel');
/**
 * param 1: Instantiation
 * param 2: Options setting
 */
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      // Validation, if name is not specified, put the error message
      required: [true, 'A tour must have a name!'],
      // name must be unique
      unique: true,
      trim: true,
      maxLength: [40, 'A tour must have less or equal than 40 characters!'],
      minLength: [5, 'A tour must have more or equal than 5 characters!'],
      // validate: [validator.isAlpha, 'Name must only contain character!'],
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration!'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size!'],
    },
    difficulty: {
      type: String,
      // required: [true, 'A tour must have a difficulty!'],
      required: {
        values: true,
        message: 'A tour must have a difficulty!',
      },
      // enum can ONLY be used in String type
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty must be either easy, medium or difficult!',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0!'],
      max: [5, 'Rating must be below 5.0!'],
      // 'set' will be run each time when 'ratingsAverage' gets updated
      // 'val' param is the original value that about to be set. The return value of the callback function below is the final value that will be set
      set: (val) => Math.round(val * 10) / 10, // 4.6666 -> 46.6666 -> 47 -> 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price!'],
    },
    priceDiscount: {
      type: Number,
      //* CUSTOMIZED VALIDATOR
      validate: {
        // The 'val' param in the validator function is the priceDiscount we input
        validator: function (val) {
          //! 'this' only points to current doc on NEW document creation
          return val < this.price;
        },
        // {VALUE} refers to the value we input
        message: 'Discount price ({VALUE}) must be below the regular price!',
      },
    },
    summary: {
      type: String,
      // If true, remove all the white space in the beginning and in the end of the string
      trim: true,
      required: [true, 'A tour must have a summary!'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image!'],
    },
    images: [String],
    // Generate when create a new Tour
    createdAt: {
      type: Date,
      // Mongoose will automatically convert the timestamp from milliesecond to real date
      default: Date.now(),
      // Will not show this field to the client
      select: false,
    },
    startDates: [Date],
    slug: { type: String },
    secretTour: { type: Boolean, default: false },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        // Specify the field only to be 'Point'
        enum: ['Point'],
      },
      // Number array, First Longitute, then latitude
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // Use this for embedding other documents
    // guides: Array

    guides: [
      {
        // Each element in the guides array should be MongoDB id
        type: mongoose.Schema.Types.ObjectId,
        // Referenced collection(mongoose.model) name
        //! When referencing a collection, no need to require that model(E.g. require('./userModel'))
        //! But have to firstly created this model IN MONGOOSE, otherwise will not working, EVEN IF you have that collection in MongoDB
        ref: 'User',
      },
    ],
  },
  {
    // If virtuals: true, the virtual fields will show in the response
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

//* Improving read performance with index
// Set the index on the price, 1 for ascending, -1 for descending
tourSchema.index({ price: 1, ratingsAverage: -1 });
// Here, the value 1 is not important
tourSchema.index({ slug: 1 });
// '2dsphere' is given over to real geospacial data
tourSchema.index({ startLocation: '2dsphere' });

// Virtual properties, won't be stored in the database
//* Calculation of duration weeks is a business logic, so it belongs to 'Model' part in MVC, not in the controller
//* If want to use 'this', ALWAYS USE REGULAR FUNCTION! Not the arrow function
// This function is mounted on GET method
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  // In reviewSchema, the 'tour' field is exactly the '_id' of Tour, same like foreign key
  foreignField: 'tour',
});

// DOCUMENT MIDDLEWARE, run before .save() and .create()
tourSchema.pre('save', function (next) {
  // 'this' refers to the newly created document(model instance) object
  // Modify the fields in the new document
  this.slug = slugify(this.name, { lower: true });
  this.difficulty = 'hard';
  // console.log('The first pre middleware for the SAVE method');
  next();
});

// //* Embedding guides from user documents into tour documents
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(
//     async (guideId) => await User.findById(guideId),
//   );
//   //* Use Promise.all() to await promises in an array
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// Run after .save() and .create()
tourSchema.post('save', function (document, next) {
  // 'document' vairable refers to the stored document
  // console.log(document);
  next();
});

// QUERY MIDDLEWARE
// Regular expression, ^ stands for all strings start with 'find'
tourSchema.pre(/^find/, async function (next) {
  // 'this' refers to the query object in mongoose
  // Select tours only when it's not a secret tour
  this.find({ secretTour: { $ne: true } });
  next();
});

tourSchema.pre(/^find/, function (next) {
  // .populate() is to replace the specified field I referenced(here is 'guides') with actual related data,
  // the results will look like embedding documents from another collection
  this.populate({
    path: 'guides',
    // Exclude fields from the referenced document
    select: '-__v -passwordChangedAt',
  });

  next();
});

// AGGREGATE MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  // If the first stage of the aggregation pipeline is '$geoNear', then remain unchanged
  if (Object.keys(this.pipeline()[0]).includes('$geoNear')) return next();

  // .unshift() will insert an element at the beginning of an array
  // Here, insert the $match aggregation stage at the very beginning, so $match stage will always be the first stage
  this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  next();
});

/**
 * param 1: specify the collection name,
 * in MongoDB, the collection name will automatically transforms to plural one and lowercase. E.g. 'Tour' -> 'tours'
 *
 * param 2: specify the schema that the model use
 */
const Tour = mongoose.model('Tour', tourSchema);
module.exports = Tour;
