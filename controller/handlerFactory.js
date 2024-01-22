/* eslint-disable prefer-destructuring */
/* eslint-disable arrow-body-style */
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

/**
 * @param Model: mongoose.model('moodelName', mongoose.schema), E.g. tourModel
 * @returns function, contains (req, res, next) params
 */
exports.deleteOne = (Model) => {
  //! Here actually CALL the catchAsync function because here is catchAsync(), NOT catchAsync!
  //! So when calling deleteOne, it will firstly trigger catchAsync, catchAsync then returns the anonymous
  //! function inside catchAsync, then deleteOne returns the anonymous function that catchAsync passed to, again!
  return catchAsync(async (req, res, next) => {
    // It's a convention that don't send back any data to the client when execute DELETE operation
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) {
      // Address the NOT FOUND error manually, not through catch() in catchAsync.js
      // return, so that the rest of the code won't be executed
      return next(new AppError('No document is found with this ID!', 404));
    }
    // When set status to 204, there's no content display on the postman
    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
};

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    /**
     * param 1: id of the tour that will be updated
     * param 2: updated content
     */
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      // If new: true, return the modified data
      new: true,
      // If runValidators: true, everytime when updating a document, will check the validation set in tourModel
      runValidators: true,
    });
    if (doc === null) {
      // Address the NOT FOUND error manually, not through catch() in catchAsync.js
      // return, so that the rest of the code won't be executed
      return next(new AppError(`No document is found with this ID!`, 404));
    }
    res.status(200).json({
      status: 'success',
      data: { doc: doc },
    });
  });

exports.createOne = (Model) =>
  // catchAsync function is called here
  catchAsync(async (req, res, next) => {
    // const newTour=new Tour({})
    // newTour.save().then()

    // The database will only save fields that specified in schema, others will be ignored
    // doc receives the object that just created
    const doc = await Model.create(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        doc: doc,
      },
    });
  });

/**
 * @param {2} populateOptions: an object, for setting options of populate
 */
exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    // req.params is an object contains all the parameters in URL
    //* 1. Use findOne(), which is similar to the find method in MongoDB
    //* const tour = await Tour.findOne({ _id: req.params.id });
    // .populate() is to replace the specified field I referenced with actual related data, the results will look like embedding documents from another collection
    let query = Model.findById(req.params.id);
    if (populateOptions) query = query.populate(populateOptions);
    // {path: 'reviews',select: 'review user -tour'}
    const doc = await query;

    if (!doc) {
      // Address the NOT FOUND error manually, not through catch() in catchAsync.js
      // return, so that the rest of the code won't be executed
      return next(new AppError('No document is found with this ID!', 404));
    }
    res.status(200).json({
      status: 'success',
      data: {
        doc: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res) => {
    let filter = {};
    // If through /:tourId/reviews, then search reviews related to this tour
    //! This line of code is only for /:tourId/reviews
    if (req.params.tourId) filter = { tour: req.params.tourId };

    // BUILD QUERY
    const features = new APIFeatures(Model.find(filter), req.query)
      // Because every method have a 'return this', so can be chain up
      .filter()
      .sort()
      .limitFields()
      .pagination();

    // .explain() will instead returns response with query details to let developer evaluate the performance
    // const query = features.query.explain();
    const query = features.query; //.explain();

    // EXECUTE QUERY
    const doc = await query; //.populate('reviews');
    res
      .status(200)
      //* Parsing the object to json automatically
      //* And set the 'Content-Type' to 'application/json' AUTOMATICALLY
      .json({
        //Send the response in json format
        status: 'success',
        results: doc.length,
        data: doc,
      });
  });
