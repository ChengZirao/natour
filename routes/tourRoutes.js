const express = require('express');
const authController = require('../controller/authController');
//Import handler methods from Controller as an Object
const tourController = require('../controller/tourController');
const reviewRouter = require('../routes/reviewRoutes');

// Middleware to designate parent router
const router = express.Router();

//* Middleware stacks ⬇⬇⬇

// // Local middleware, to capture id in '/:id' request
// // Intercept the requests who contains '/:id', check the ID validation before hitting handler functions(like GET, POST)
// router.param('id', tourController.checkID);

/* // Nested Routes(involve tour and review routes)
router.route('/:tourId/reviews').post(
  /// Only user who has logged in can write a review
  authController.protect,
  /// Only regular user can write a review
  authController.restrictTo('user'),
  reviewController.createReview,
); */

// Nested Routes, same as the code in 'app.js'
router.use('/:tourId/reviews', reviewRouter);

//* methods like post and get are route handlers, which are also middlewares!
router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan,
  );

// :distance == searching distance(radius)
// :latlng == abbreviation for latitude and longitude, the geo info of the current tour
// :unit == miles or km
// E.g. /tours-within/300/center/34.080228,-118.396196/unit/mi means:
// Find all the startLocations that less than 300 miles from the coordinate of '34.080228,-118.396196'
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  // Chain the middlewares, execute functions from the first param to the end(first checkBox(), then createTour())
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour,
  );

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.updateTour,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour,
  );

module.exports = router;
