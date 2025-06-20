// src/user.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose'
import { paginate } from '../src'

export interface IUser extends Document {
  name: string
  email: string
}

const userSchema = new Schema<IUser>(
  {
    name: String,
    email: String,
  },
  { timestamps: true }
)

userSchema.plugin(paginate)

const UserModel: Model<IUser> = mongoose.model<IUser>('User', userSchema)
export default UserModel
