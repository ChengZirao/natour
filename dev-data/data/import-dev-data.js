const fs = require('fs');

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: `${__dirname}/../../config.env` });

const Tour = require('../../models/tourModel');
const Review = require('../../models/reviewModel');
const User = require('../../models/userModel');

const DBAtlas = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DBAtlas, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log('DB connection successful!');
  });

//* Read JSON FILE
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8'),
);

const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'utf-8'));

const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));

//* IMPORT DATA INTO DATABASE
const importData = async () => {
  try {
    // await Review.create(reviews);
    await User.create(users, { validateBeforeSave: false });
    // await Tour.create(tours);
    console.log('Data successfully loaded!');
    // Stop code running
    process.exit();
  } catch (err) {
    console.log(err);
    process.exit();
  }
};

//* DELETE ALL DATA FROM COLLECTIONS
const deleteData = async () => {
  try {
    await Review.deleteMany();
    await Tour.deleteMany();
    console.log('Data successfully deleted!');
    // Stop code running
    process.exit();
  } catch (err) {
    console.log(err);
  }
};

//* Use command line to import or delete all data
//* E.g. 'node .\import-dev-data.js --import'
if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}

console.log(process.argv);
