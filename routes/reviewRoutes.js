const express = require('express');
const reviewController = require('../controller/reviewController');
const authController = require('../controller/authController');

//! Have to set 'mergeParams: true', otherwise when reviewRouter is mounted on other router such as tourRoutes,
//! the reviewRouter can't read the params from tourRoutes
// E.g. tourRouter.use('/:tourId/reviews', reviewRouter), if without 'mergeParams: true',
// reviewRouter cannot read 'req.params.tourId'
const router = express.Router({ mergeParams: true });

// Only user who has logged in can get, post, or update a review
router.use(authController.protect);

router.route('/').get(reviewController.getAllReviews).post(
  // And also only role: user can write a review
  authController.restrictTo('user'),
  reviewController.setTourAndUserId,
  reviewController.createReview,
);

router
  .route('/:id')
  .get(reviewController.getReview)
  .delete(
    authController.restrictTo('admin', 'user'),
    reviewController.deleteReview,
  )
  .patch(
    authController.restrictTo('admin', 'user'),
    reviewController.updateReview,
  );

module.exports = router;
