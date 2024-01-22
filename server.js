const mongoose = require('mongoose');
const dotenv = require('dotenv');
//* Config the env variables according to .env file automatically
// Config it before requiring 'app.js'! Or when we want to get access to the env variables in app.js, we can't get anything
dotenv.config({ path: './config.env' });

// Global sychronous exception handler
//! Have to be placed at the very top of the code, so that will start the event of listening for an uncaught exception at the very beginning!
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(`${err.name}: ${err.message}`);
  process.exit(1);
});

const app = require('./app');

const DBAtlas = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

// Connect to the database
mongoose
  .connect(DBAtlas, {
    //These optional settings are aim to prevent deprecated warnings
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then((connection) => {
    //console.log(connection.connections);
    console.log('DB connection successful!');
  });
// Normally, there should have a .catch() to handle promise rejections,
// but I use 'process.on('unhandledRejection')' to handle promise rejections GLOBALLY

const server = app.listen(process.env.PORT, () => {
  console.log(`App running on port ${process.env.PORT}`);
});

// Global promise rejection handler
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(`${err.name}: ${err.message}`);
  server.close(() => {
    // After closing the server, shut down the application running
    // Param 1 stands for uncaught exception
    process.exit(1);
  });
});
