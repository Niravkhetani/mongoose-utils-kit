import mongoose, { Schema, Document } from 'mongoose';
// Assuming the root index.ts exports these items correctly
import { paginate, PaginateModel, toJSONPlugin } from '../src';

// Extended interfaces for testing nested fields and private properties
export interface IProfile {
  age: number; // Will be set to private: true
  city: string;
  location: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; // Private field
  privateField?: string; // Private field
  profile?: IProfile; // Nested object
  tags: string[];
  isActive: boolean;
  adjustedScore: number;
  score: number;
  totalScore: number;
  keywords: 'dev' | 'alias';
  fullName?: String;
  userEmail?: String;
  createdAt: Date;
  updatedAt: Date;
}

// Define Schema for testing
const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, private: true }, // Private field test
    privateField: { type: String, default: 'secret', private: true }, // Simple private field test
    profile: {
      age: { type: Number, private: true }, // Nested private field test
      city: String,
    },
    tags: [String],
    isActive: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Apply plugins
userSchema.plugin(paginate);
userSchema.plugin(toJSONPlugin);

// Export the Model, cast to PaginateModel for type checking in tests
export const TestUserModel = mongoose.model<IUser>('TestUser', userSchema) as PaginateModel<IUser>;

export default TestUserModel;
