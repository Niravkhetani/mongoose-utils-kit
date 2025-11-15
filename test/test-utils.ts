import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | null = null;

jest.setTimeout(30000);

/**
 * Initializes the MongoDB Memory Server and connects Mongoose.
 */
export const connect = async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
};

/**
 * Drops the database and disconnects Mongoose.
 */
export const close = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
  }
};

/**
 * Clears all data from the TestUserModel collection.
 */
export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};
