// chat/schemas/chat-room.schema.ts
import mongoose, { Document, Schema } from 'mongoose';

export enum RoomType {
  TASK = 'task',
  // extendable for future use (group, direct, etc.)
}

export interface IParticipant {
  userId: mongoose.Types.ObjectId;
  // add role, read cursor etc. if needed
}

export type ObjectId = mongoose.Schema.Types.ObjectId;

export const ChatRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'New Chat Room',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    task_picture: {
      type: String,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: [(val: any[]) => val.length >= 2, 'At least two participants required'],
      required: true,
    },
    // helper field to ensure uniqueness irrespective of participants order
    participantsKey: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.TASK,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// ensure uniqueness: one room per task + same participants set
ChatRoomSchema.index({ taskId: 1, participantsKey: 1 }, { unique: true });

// pre-save to compute participantsKey (sort string)
ChatRoomSchema.pre('validate', function (next) {
  // @ts-ignore
  if (!this.participants || !Array.isArray(this.participants)) return next();
  // sort lexicographically the ObjectId strings
  // @ts-ignore
  this.participants = Array.from(new Set(this.participants.map((p) => p.toString()))).map(
  (s) => new mongoose.Types.ObjectId(s),
);

  // @ts-ignore
  this.participants.sort((a: any, b: any) => a.toString().localeCompare(b.toString()));
  // @ts-ignore
  this.participantsKey = this.participants.map((p: any) => p.toString()).join('_');
  next();
});

export interface ChatRoom extends Document {

  name: string;
  taskId: mongoose.Types.ObjectId | string;
  task_picture: string;
  participants: mongoose.Types.ObjectId[] | string[];
  participantsKey: string;
  type: RoomType;
  lastMessageAt: Date;
  unreadCounts: Map<string, number>;
}
