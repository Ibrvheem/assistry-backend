import mongoose, { Schema } from 'mongoose';
import { Document } from 'mongoose';

import { AssetDTO } from 'src/commons/dto/asset.dto';
export enum TaskStatus {
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  PENDING = 'pending',
  ONGOING = 'ongoing',
  FINISHED='finished',
  COMPLETED = 'completed',
  EXPIRED = "expired",
  CANCELED = 'canceled',
}
const AssetSchema = new Schema({
  assetStorageKey: { type: String, required: true },
  kind: {
    type: String,
    required: true,
  },
});

export interface Asset extends Document {
  kind: string;
  assetStorageKey: string;
}

export const TaskSchema = new mongoose.Schema({
  task: { type: String, required: true },
  description: { type: String },
  incentive: { type: Number, required: true },
  assets: { type: [AssetSchema] },
  location: { type: String, required: true },
  expires: { type: Number, require: true },
  views:{ type: Number, default: 0 },
  status: {
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'User',
  },
  declinedBy: { type: [mongoose.Schema.Types.ObjectId], required: false },
  viewedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  created_at: {
    type: Date,
    default: new Date(),
  },
});

export interface Task {
  id: string;
  task: string;
  description: string;
  incentive: number;
  visual_context: string;
  location: string;
  expires: string;
  views:string,
  user_id: string;
  created_at: string;
  updated_at: string;
  acceptedBy: string;
  declinedBy: string[];
  viewedBy: string[];
  assets?: Asset[];
  status: TaskStatus;
}
