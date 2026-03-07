const mongoose = require('mongoose');
const { mongoUri } = require('./env');

const connectDB = async () => {
  await mongoose.connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
};

module.exports = { connectDB };