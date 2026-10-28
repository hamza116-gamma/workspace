// Test database helpers. Tests run against a SEPARATE database on the
// configured cluster (TEST_DB_NAME, default "circlechat_test"), never the
// app's own database, and every test file starts from an empty database.
require('dotenv').config();
const mongoose = require('mongoose');

const TEST_DB_NAME = process.env.TEST_DB_NAME || 'circlechat_test';

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to run the tests');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, { dbName: TEST_DB_NAME });
  if (mongoose.connection.name !== TEST_DB_NAME) {
    throw new Error(`Refusing to run tests against "${mongoose.connection.name}"`);
  }
  await mongoose.connection.dropDatabase();
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

module.exports = { connect, disconnect, TEST_DB_NAME };
