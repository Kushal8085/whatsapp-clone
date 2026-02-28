const mongoose = require('mongoose');

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Mongo database connected successfully");
  } catch (error) {
    console.error('error connecting database', error.message)
    process.exit(1)
  }
}

module.exports = connectDb;