/* eslint-disable arrow-body-style */
// Use catchAsync function to avoid using try/catch block
// Handle the errors of all functions here UNIFORMLY
module.exports = (fn) => {
  return (req, res, next) => {
    // Call the function
    fn(req, res, next).catch((err) => next(err));
  };
};
