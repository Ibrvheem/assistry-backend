import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  profile_picture: { type: String },
  email: { type: String, required: true },
  password: { type: String },
  phone_no: { type: String, required: true },
  reg_no: { type: String, required: true },
  otp: { type: String },
  department: { type: String },
  level: { type: String },
  bio: { type: String },
  status: { type: String },
  created_at: { type: Date },
  updated_at: { type: Date },
});

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture: string;
  email: string;
  password: string;
  phone_no: string;
  reg_no: string;
  department:  string,
  level:  string,
  bio: string,
  otp: string;
  status: string;
  created_at: string;
  updated_at: string;
}
