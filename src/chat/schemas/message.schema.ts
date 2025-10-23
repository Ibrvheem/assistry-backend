// // chat/schemas/message.schema.ts
// import mongoose, { Document } from 'mongoose';

// export enum MessageType {
//   TEXT = 'text',
//   IMAGE = 'image',
//   AUDIO = 'audio',
//   // extendable (video, file, etc.)
// }

// export const MessageSchema = new mongoose.Schema(
//   {
//     roomId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'ChatRoom',
//       required: true,
//       index: true,
//     },
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//       index: true,
//     },
//     type: {
//       type: String,
//       enum: Object.values(MessageType),
//       default: MessageType.TEXT,
//     },
//     text: { type: String },
//     // attachments array: flexible to store uploaded object metadata
//     attachments: [
//       {
//         kind: { type: String },
//         url: { type: String, required: true },
//         key: { type: String, required: false }, // storage key
//         meta: { type: Object, default: {} },
//       },
//     ],
//     readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
//     createdAt: { type: Date, default: Date.now, index: true },
//   },
//   { timestamps: true },
// );

// export interface Message extends Document {
//   roomId: mongoose.Types.ObjectId | string;
//   sender: mongoose.Types.ObjectId | string;
//   type: MessageType;
//   text?: string;
//   attachments?: { kind?: string; url: string; key?: string; meta?: any }[];
//   readBy?: string[] | mongoose.Types.ObjectId[];
//   createdAt?: Date;
// }


// chat/schemas/message.schema.ts
import mongoose, { Document } from 'mongoose';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  FILE='file',

  // extendable (video, file, etc.)
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  SEEN= 'seen',
  // extendable (video, file, etc.)
}

export const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    text: { type: String },
    status: { type: String,required:false },

    // 🔥 New: replyTo — reference to another message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: false,
      index: true,
    },

    attachments: [
      {
        kind: { type: String },
        url: { type: String, required: true },
        key: { type: String },
        meta: { type: Object, default: {} },
      },
    ],

    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },

    createdAt: { type: Date, default: Date.now, index: true },
    seenAt:{ type: Date, required:false },
  },
  { timestamps: true },
);

export interface Message extends Document {
  roomId: mongoose.Types.ObjectId | string;
  sender: mongoose.Types.ObjectId | string;
  type: MessageType;
  text?: string;
  status?: string;
  attachments?: { kind?: string; url: string; key?: string; meta?: any }[];
  readBy?: string[] | mongoose.Types.ObjectId[];
  replyTo?: mongoose.Types.ObjectId | string | null;
  createdAt?: Date;
  seenAt?: Date;
}
