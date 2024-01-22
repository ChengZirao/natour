/* eslint-disable node/no-unsupported-features/es-syntax */
class APIFeatures {
  /**
   * @param {1} query : query object from Mongoose
   * @param {2} queryString : req.query(although named queryString but actually is an object)
   */
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // 1) Filtering
  filter() {
    // 1A) Filtering

    //* Use {...Object} to create a new object to achieve shallow copy
    let queryObj = { ...this.queryString };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced filtering

    // When requesting 'GET ?duration[gte]=5'
    // queryStr will be { duration: { 'gte': '5' } }
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gte|gt|lt|lte)\b/g,
      // 'matchStr' is the matched word(e.g. 'gte')
      // Add '$' in front of the matched string, so MongoDB can execute find() method.
      (matchStr) => `$${matchStr}`,
    );
    queryObj = JSON.parse(queryStr);
    this.query = this.query.find(queryObj);
    // const query = Tour.find({ duration: { '$gte': '5' }, difficulty: 'easy' });
    return this;
  }

  // 2) Sorting
  sort() {
    if (this.queryString.sort) {
      // E.g. 'GET ?sort=-price,duration'
      // Replace the comma with space, so that according to the sort() grammar
      const sortBy = this.queryString.sort.split(',').join(' ');

      // Chain the query with sort() method
      // sort('-price duration')
      this.query = this.query.sort(sortBy);
    } else {
      // Set default sort condition: sort by created time from latest to oldest
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  // 3) Field limiting
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      // Use minus symbol to exclude '__v' field, which means show all fields to the client except '__v'
      this.query = this.query.select('-__v');
    }
    return this;
  }

  // 4) Pagination
  pagination() {
    // Get the page in the request, or set 1 as default
    const page = this.queryString.page * 1 || 1;
    // Get the limit in the request, or set 100 as default
    // 'limit' variable represents the quantity of results a page showed
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    // Skip 10 results, which equals to skip page 1
    // query = query.skip(10).limit(10);
    return this;
  }
}

module.exports = APIFeatures;
