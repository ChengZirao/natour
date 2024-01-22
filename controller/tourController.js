/* eslint-disable arrow-body-style */
/* eslint-disable no-unused-expressions */
/* eslint-disable prefer-destructuring */
/* eslint-disable node/no-unsupported-features/es-syntax */
//Handlers(also called controller in MVC context) here
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

// exports.checkID = function (req, res, next, val) {
//   //console.log(`id is: ${val}`);
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID(checkID)',
//     });
//   }
//   next();
// };

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = '-ratingsAverage,price';
  req.query.page = 1;
  req.query.fields = 'name,price,ratingsAverage';
  next();
};

exports.getAllTours = factory.getAll(Tour);

exports.getTour = factory.getOne(Tour, {
  path: 'reviews',
  select: 'review user rating createdAt -tour',
});

exports.createTour = factory.createOne(Tour);

exports.updateTour = factory.updateOne(Tour);

exports.deleteTour = factory.deleteOne(Tour);
// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);
//   if (!tour) {
//     return next(new AppError('No tour is found with this ID!', 404));
//   }
//   res.status(204).json({
//     status: 'success',
//     data: { tour: null },
//   });
// });

exports.getTourStats = catchAsync(async (req, res) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        // Group by specified id field, here I group by difficulty
        _id: '$difficulty',
        // Below are statistics in each group
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      // Deconstruct the object which has multiple startDates to many objects
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      // Add a new field to the response data
      $addFields: { month: '$_id' },
    },
    {
      // When the value of one field is 0, the field won't show up
      $project: { _id: 0 },
    },
    {
      // Sort in descending
      $sort: { numTourStarts: -1 },
    },
    {
      // Only shows the first 12 results
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: plan.length,
    data: plan,
  });
});

// /tours-within/300/center/34.080228,-118.396196/unit/mi means:
// Find all the startLocations that less than 300 miles from the coordinate of '34.080228,-118.396196'
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format "lat,lng".',
        400,
      ),
    );
  }

  // 3693.2 and 6378.1 are radius of the Earth in miles and km
  const radius = unit === 'mi' ? distance / 3693.2 : distance / 6378.1;

  const tours = await Tour.find({
    // $geoWithin: find tours where the startLocation is within the radius
    // $centerSphere: param 1 takes in an array of latitude and longitude, param 2 takes in the radius as search condition
    //! MongoDB expects the radius variable to be the 'distance / radius of the Earth'
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    result: tours.length,
    data: tours,
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format "lat,lng".',
        400,
      ),
    );
  }
  const distances = await Tour.aggregate([
    {
      // $geoNear should be at the very first place
      // And require at least one field that contains geospacial index(here is the 'startLocation')
      $geoNear: {
        // All the distances will be calculated from the point that 'near' defined
        // 'near' should be specified as geoJSON format
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        // All the calculated distances will be stored at this place
        distanceField: 'distance',
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: distances,
  });
});
