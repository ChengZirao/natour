const AppError = require('../utils/appError');

/* eslint-disable node/no-unsupported-features/es-syntax */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    Alibaba: '阿里巴巴是个快乐的青年',
  });
};

const sendErrorProd = (err, res) => {
  // Operational and trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      isOperational: true,
    });
  }
  // Programming error or other unknown error: don't leak error details to the client
  // And developer needs to find out and address these errors ASAP
  else {
    res.status(500).json({
      status: 500,
      message: 'Something went wrong!',
    });
  }
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const message = `Duplicated field value: '${err.keyValue.name}', please set another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  // Object.values(err.errors) will return all the values of the 'err.errors' object, as an array
  // map((element) => element.message) will then get access to those values and return all the messages
  //* To sum up, 'errors' variable contains all the `err.errors.${fieldName}.message`
  const errors = Object.values(err.errors).map((element) => element.message);
  const message = `Invalid input data: "${errors.join('. ')}"`;
  return new AppError(message, 400);
};

const handleJWTError = () => {
  const message = 'Invalid token! Please login again.';
  return new AppError(message, 401);
};

const handleJWTExpiredError = () => {
  const message = 'Your login has expired! Please login again.';
  return new AppError(message, 401);
};

// Global Error Handling Middleware
module.exports = (err, req, res, next) => {
  // err.stack shows where the error happened in code
  console.log(err.stack);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // If in development mode, send information with details
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  }
  // If in production mode, send user-friendly information
  else if (process.env.NODE_ENV === 'production') {
    console.log(err);
    // When failing converting params(like /:id) to valid format
    if (err.name === 'CastError') sendErrorProd(handleCastErrorDB(err), res);

    // When creating new document with duplicated field
    if (err.code === 11000) sendErrorProd(handleDuplicateFieldsDB(err), res);

    // When having validation errors from mongoose.schema
    if (err.name === 'ValidationError')
      sendErrorProd(handleValidationErrorDB(err), res);

    if (err.name === 'JsonWebTokenError') sendErrorProd(handleJWTError(), res);

    if (err.name === 'TokenExpiredError')
      sendErrorProd(handleJWTExpiredError(), res);

    sendErrorProd(err, res);
  }
};
