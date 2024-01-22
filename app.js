const express = require('express');
// A third-party middleware, to log request information
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controller/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');

// express() is a function, when calling, will add a bunch of methods to the 'app' variable
const app = express();

//* 1) Global MIDDLEWARES

// Set security HTTP headers
app.use(helmet());

// Development Mode console logging
if (process.env.NODE_ENV === 'development') {
  // When setting 'dev', monitor and log every request info to terminal
  app.use(morgan('dev'));
}
console.log(process.env.NODE_ENV);

// Limit requests from the same IP address
const limiter = rateLimit({
  // Allow 100 requests from the same IP
  max: 100,
  // in 1 hour
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP! Please try again after an hour!',
});
// Limit routes that start with '/api'
// Limiting info will be stored in headers of response
app.use('/api', limiter);

//* Body parser, reading data from request body into req.body
// limit: '10kb', will limits data of body no more than 10 kilo bytes
app.use(express.json({ limit: '10kb' }));

// Data sanitization against NoSQL query injection
// Will filter out all '$' signs in request body, request query string and req.params
app.use(mongoSanitize());

// Data sanitization against cross-site scripting(XSS) attack
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(
  hpp({
    // Whitelist will allow duplicate query keys(like ?duration=5&duration=9) in specified fields
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// When server don't find the request URL, will navigate to this one
// e.g. when requesting "http://localhost:3000/overview.html", the server can't fint "/overview.html",
// then it will navigate to "${__dirname}/public/overview.html"
app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  //! Have to use next() or the req/res cycle will be stucked!! And can't send back response to the client
  next();
});

// app.get('/api/v1/tours', getAllTours);
// app.get('/api/v1/tours/:id', getTour);
// app.post('/api/v1/tours', createTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);
app.use('/api/v1/tours', tourRouter);

// When a new request for '/api/v1/users/xxx', it will hit this middleware and run the userRouter
app.use('/api/v1/users', userRouter);

app.use('/api/v1/reviews', reviewRouter);

// Handle all the unhandled routes
//* This middleware will be hit ONLY WHEN the request url didn't hit the '/api/v1/tours' or '/api/v1/users'
// .all() includes all of the RESTful methods, '*' stands for every suffix URL in 'localhost:3000'
app.all('*', (req, res, next) => {
  //* When next() contains a param, will assume it as an Error object,
  //* and skip all the other middlewares, send it right to the Global Error Handling Middleware
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handling Middleware
app.use(globalErrorHandler);

module.exports = app;
