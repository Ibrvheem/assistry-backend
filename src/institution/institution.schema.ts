import mongoose from 'mongoose';

export const InstitutionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  state: { type: String, required: true },
  abbreviation: { type: String, required: true },
});

export interface Institution {
  id: string;
  name: string;
  state: string;
  abbreviation: string;
}
