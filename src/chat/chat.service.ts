// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Message } from './entities/chat.entity';
// import { CreateChatDto } from './dto/create-chat.dto';

// @Injectable()
// export class ChatService {
//   constructor(
//     @InjectModel(Message.name) private messageModel: Model<Message>,
//   ) {}

//   async saveMessage(payload: string | CreateChatDto) {
//     try {
//       // If payload is a string, parse it
//       if (typeof payload === 'string') {
//         payload = JSON.parse(payload);
//       }

//       console.log('Parsed Payload:', payload);

//       if (typeof payload !== 'object') {
//         throw new Error('Payload must be an object');
//       }

//       const message = new this.messageModel(payload);
//       return await message.save();
//     } catch (error) {
//       console.error('Error parsing payload:', error);
//       throw new Error('Invalid payload format');
//     }
//   }

//   async getChatHistory(user1: string, user2: string) {
//     return this.messageModel
//       .find({
//         $or: [
//           { senderId: user1, receiverId: user2 },
//           { senderId: user2, receiverId: user1 },
//         ],
//       })
//       .sort({ createdAt: 1 })
//       .exec();
//   }
// }

// chat/chat.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom } from './schemas/chat-room.schema';
import { Message } from './schemas/message.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { TasksService } from 'src/tasks/tasks.service';
import { UsersService } from 'src/users/users.service';


// lean type helper to strip mongoose Document metadata
type Lean<T> = Omit<T, keyof Document>;

@Injectable()
export class ChatService {
  constructor(
    @InjectModel('ChatRoom') private readonly roomModel: Model<ChatRoom>,
    @InjectModel('Message') private readonly messageModel: Model<Message>,
    private readonly taskService: TasksService,
    private readonly usersService: UsersService,
    
  ) {}

  /**
   * Find an existing room between participants for a given task, or create a new one.
   */
  async findOrCreateRoom(
    creatorId: string,
    dto: CreateRoomDto,
  ): Promise<Lean<ChatRoom>> {
    // participants set: creator + provided participants
    const participantsSet = new Set<string>([creatorId, ...(dto.participants || [])]);
    // const participantsSet = new Set<string>([...(dto.participants || [])]);
    if (participantsSet.size < 2) {
      throw new BadRequestException('At least two distinct participants required');
    }

    const participants = Array.from(participantsSet).sort(); // consistent order
    const participantsKey = participants.join('_');

    // try to find existing room
    const existing = await this.roomModel
      .findOne({ taskId: dto.taskId, participantsKey })
      .lean<Lean<ChatRoom>>();
    if (existing) return existing;
//     if (existing) {
//   await this.roomModel.deleteOne({ _id: existing._id });
// }

    const task= await this.taskService.findOne101(dto.taskId);
    if(!task) {
      throw new NotFoundException('Task not found');
    };


    // otherwise, create a new room
    const created = await this.roomModel.create({
      name: task.task.slice(0, 20), 
      taskId: dto.taskId,
      participants,
      participantsKey,
      task_picture: task.assets.length > 0 ? task.assets[0].url : null,
    });

    return created.toObject() as Lean<ChatRoom>;
  }

  /**
   * Retrieve chat rooms for a given user.
   */
async getRoomsForUser(
  userId: string,
  limit = 20,
  skip = 0,
): Promise<
  Array<
    Pick<
      ChatRoom,
      'taskId' | 'participants' | 'lastMessageAt' | 'task_picture' | 'name'
    > & {
      users: Array<{ _id: string; first_name: string; last_name: string; profile_picture?: string }>;
      task?: any;
      lastMessage?: {
        _id: string;
        text?: string;
        type: string;
        sender: string;
        createdAt: Date;
      };
      unreadCount: number;
    }
  >
> {
  const objectUserId = new Types.ObjectId(userId);

  const rooms = await this.roomModel
    .aggregate([
      { $match: { participants: objectUserId } },
      { $sort: { lastMessageAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // Users
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'users',
          pipeline: [
            { $project: { _id: 1, first_name: 1, last_name: 1, profile_picture: 1 } },
          ],
        },
      },

      // Task
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'task',
          pipeline: [
            {
              $project: {
                _id: 1,
                task: 1,
                location: 1,
                incentive: 1,
                status: 1,
                created_at: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },

      // Last message
      {
        $lookup: {
          from: 'messages',
          let: { roomId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$roomId', '$$roomId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                text: 1,
                type: 1,
                sender: 1,
                createdAt: 1,
              },
            },
          ],
          as: 'lastMessage',
        },
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },

      // ✅ Compute unreadCount dynamically from unreadCounts map
      {
        $addFields: {
          unreadCount: {
            $ifNull: [{ $toInt: { $getField: { field: userId, input: '$unreadCounts' } } }, 0],
          },
        },
      },

      // Project final shape
      {
        $project: {
          _id: 1,
          taskId: 1,
          participants: 1,
          lastMessageAt: 1,
          task_picture: 1,
          name: 1,
          users: 1,
          task: 1,
          lastMessage: 1,
          unreadCount: 1,
        },
      },
    ])
    .allowDiskUse(true)
    .exec();

  return rooms;
}

// async getRoomsForUser(
//   userId: string,
//   limit = 20,
//   skip = 0,
// ): Promise<
//   Array<
//     Pick<
//       ChatRoom,
//       'taskId' | 'participants' | 'lastMessageAt' | 'task_picture' | 'name'
//     > & {
//       users: Array<{
//         _id: string;
//         first_name: string;
//         last_name: string;
//         profile_picture?: string;
//       }>;
//       task?: any;
//       lastMessage?: {
//         _id: string;
//         text?: string;
//         type: string;
//         sender: string;
//         createdAt: Date;
//       };
//     }
//   >
// > {
//   const objectUserId = new Types.ObjectId(userId);

//   const rooms = await this.roomModel
//     .aggregate([
//       // 1️⃣ Find rooms where the current user is a participant
//       {
//         $match: { participants: objectUserId },
//       },

//       // 2️⃣ Lookup participants (users)
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'participants',
//           foreignField: '_id',
//           as: 'users',
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//                 first_name: 1,
//                 last_name: 1,
//                 profile_picture: 1,
//               },
//             },
//           ],
//         },
//       },

//       // 3️⃣ Lookup the related task
//       {
//         $lookup: {
//           from: 'tasks',
//           localField: 'taskId',
//           foreignField: '_id',
//           as: 'task',
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//                 task: 1,
//                 location: 1,
//                 incentive: 1,
//                 status: 1,
//                 created_at: 1,
//               },
//             },
//           ],
//         },
//       },
//       { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },

//       // 4️⃣ Lookup the latest message
//       {
//         $lookup: {
//           from: 'messages',
//           let: { roomId: '$_id' },
//           pipeline: [
//             { $match: { $expr: { $eq: ['$roomId', '$$roomId'] } } },
//             { $sort: { createdAt: -1 } },
//             { $limit: 1 },
//             {
//               $project: {
//                 _id: 1,
//                 text: 1,
//                 type: 1,
//                 sender: 1,
//                 createdAt: 1,
//               },
//             },
//           ],
//           as: 'lastMessage',
//         },
//       },
//       { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },

//       // 5️⃣ Project only the fields we actually need
//       {
//         $project: {
//           _id: 1,
//           taskId: 1,
//           participants: 1,
//           lastMessageAt: 1,
//           task_picture: 1,
//           name: 1,
//           users: 1,
//           task: 1,
//           lastMessage: 1,
//         },
//       },

//       // 6️⃣ Sort by lastMessageAt descending (newest activity first)
//       { $sort: { lastMessageAt: -1 } },

//       // 7️⃣ Pagination
//       { $skip: skip },
//       { $limit: limit },
//     ])
//     .allowDiskUse(true)
//     .exec();

//   return rooms;
// }


//   async getRoomsForUser(
//   userId: string,
//   limit = 20,
//   skip = 0,
// ): Promise<
//   Array<
//     Pick<
//       ChatRoom,
//       'taskId' | 'participants' | 'lastMessageAt' | 'task_picture' | 'name'
//     > & {
//       users: Array<{
//         _id: string;
//         first_name: string;
//         last_name: string;
//         profile_picture?: string;
//       }>;
//       task?: any;
//     }
//   >
// > {
//   const objectUserId = new Types.ObjectId(userId);

//   const rooms = await this.roomModel
//     .aggregate([
//       // 1️⃣ Match rooms where this user is a participant
//       {
//         $match: { participants: objectUserId },
//       },

//       // 2️⃣ Lookup participants (user profiles)
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'participants',
//           foreignField: '_id',
//           as: 'users',
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//                 first_name: 1,
//                 last_name: 1,
//                 profile_picture: 1,
//               },
//             },
//           ],
//         },
//       },

//       // 3️⃣ Lookup associated task (summary info)
//       {
//         $lookup: {
//           from: 'tasks',
//           localField: 'taskId',
//           foreignField: '_id',
//           as: 'task',
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//                 task: 1,
//                 location: 1,
//                 incentive: 1,
//                 status: 1,
//                 created_at: 1,
//               },
//             },
//           ],
//         },
//       },

//       // 4️⃣ Unwind task (keep null if not found)
//       { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },

//       // 5️⃣ Project only needed fields (✅ added name)
//       {
//         $project: {
//           _id: 1,
//           taskId: 1,
//           participants: 1,
//           lastMessageAt: 1,
//           task_picture: 1,
//           name: 1, // 👈 include chat name
//           users: 1,
//           task: 1,
//         },
//       },

//       // 6️⃣ Sort newest activity first (✅ ensure sort by lastMessageAt)
//       { $sort: { lastMessageAt: -1 } },

//       // 7️⃣ Pagination
//       { $skip: skip },
//       { $limit: limit },
//     ])
//     .allowDiskUse(true)
//     .exec();

//   return rooms;
// }



  /**
   * Create and persist a new chat message.
   */
  async createMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<Lean<Message>> {
    const room = await this.roomModel.findById(dto.roomId);
    if (!room) throw new NotFoundException('Room not found');

    if (!room.participants.map(String).includes(String(senderId))) {
      throw new BadRequestException('Sender is not a participant of the room');
    }

    // 🔍 validate replyTo if provided
  let replyToDoc = null;
  if (dto.replyTo) {
    replyToDoc = await this.messageModel.findById(dto.replyTo).lean();
    if (!replyToDoc) throw new BadRequestException('Replied message not found');
    if (replyToDoc.roomId.toString() !== dto.roomId.toString()) {
      throw new BadRequestException('Cannot reply to a message from another room');
    }
  }

    const message = await this.messageModel.create({
      roomId: dto.roomId,
      sender: senderId,
      type: dto.type,
      text: dto.text,
      attachments: dto.attachments || [],
      readBy: [senderId],
    });

    // update lastMessageAt and increment unread counters
    room.lastMessageAt = message.createdAt;
    const unreadCounts = room.unreadCounts || new Map<string, number>();

    room.participants.forEach((p: any) => {
      const pid = p.toString();
      if (pid !== senderId) {
        const prev = unreadCounts.get(pid) || 0;
        unreadCounts.set(pid, prev + 1);
      }
    });

    room.unreadCounts = unreadCounts;
    await room.save();

    return message.toObject() as Lean<Message>;
  }

  /**
   * Fetch messages for a room (paginated, newest first).
   */
//   async getMessages(
//   roomId: string,
//   limit = 50,
//   before?: string,
// ): Promise<Lean<Message>[]> {
//   const query: Record<string, any> = { roomId };
//   if (before) query._id = { $lt: new Types.ObjectId(before) };

//   const messages = await this.messageModel
//     .find(query)
//     .sort({ _id: -1 })
//     .limit(limit)
//     .lean<Lean<Message>[]>()
//     .exec();

//   return messages;
// }

// async getMessages(
//   roomId: string,
//   limit = 50,
//   before?: string,
// ): Promise<any[]> {
//   const query: Record<string, any> = { roomId };
//   if (before) query._id = { $lt: new Types.ObjectId(before) };

//   const messages = await this.messageModel
//     .aggregate([
//       { $match: query },
//       { $sort: { _id: -1 } },
//       { $limit: limit },

//       // 🔥 bring replyTo info
//       {
//         $lookup: {
//           from: 'messages',
//           localField: 'replyTo',
//           foreignField: '_id',
//           as: 'replyToMessage',
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//                 text: 1,
//                 type: 1,
//                 sender: 1,
//                 attachments: 1,
//                 createdAt: 1,
//               },
//             },
//           ],
//         },
//       },
//       { $unwind: { path: '$replyToMessage', preserveNullAndEmptyArrays: true } },
//     ])
//     .allowDiskUse(true)
//     .exec();

//   return messages;
// }

async updateMessageStatus(messageId: string, status: 'delivered' | 'seen') {
  return this.messageModel.findByIdAndUpdate(
    messageId,
    { status, seenAt: status === 'seen' ? new Date() : undefined },
    { new: true },
  );
}




async getMessages(
  roomId: string,
  limit = 50,
  before?: string,
): Promise<
  Array<
    Lean<Message> & {
      senderUser?: { _id: string; first_name: string; last_name: string; profile_picture?: string };
      replyToMessage?: {
        _id: string;
        text?: string;
        type: string;
        senderUser?: { _id: string; first_name: string; last_name: string; profile_picture?: string };
      };
    }
  >
> {
  const query: any = {
    roomId: new Types.ObjectId(roomId),
  };

  if (before) query._id = { $lt: new Types.ObjectId(before) };

  const messages = await this.messageModel
    .aggregate([
      // 1️⃣ Filter by room
      { $match: query },

      // 2️⃣ Sort newest → oldest
      { $sort: { _id: -1 } },

      // 3️⃣ Limit pagination
      { $limit: limit },

      // 4️⃣ Join sender user (lean projection)
      {
        $lookup: {
          from: 'users',
          localField: 'sender',
          foreignField: '_id',
          as: 'senderUser',
          pipeline: [
            { $project: { _id: 1, first_name: 1, last_name: 1, profile_picture: 1 } },
          ],
        },
      },
      { $unwind: '$senderUser' },

      // 5️⃣ Lookup replyTo message (only if exists)
      {
        $lookup: {
          from: 'messages',
          localField: 'replyTo',
          foreignField: '_id',
          as: 'replyToMessage',
          pipeline: [
            {
              $project: {
                _id: 1,
                text: 1,
                type: 1,
                sender: 1,
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'sender',
                foreignField: '_id',
                as: 'senderUser',
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      first_name: 1,
                      last_name: 1,
                      profile_picture: 1,
                    },
                  },
                ],
              },
            },
            { $unwind: { path: '$senderUser', preserveNullAndEmptyArrays: true } },
          ],
        },
      },
      { $unwind: { path: '$replyToMessage', preserveNullAndEmptyArrays: true } },

      // 6️⃣ Final lean projection
      {
        $project: {
          _id: 1,
          roomId: 1,
          sender: 1,
          type: 1,
          text: 1,
          attachments: 1,
          createdAt: 1,
          readBy: 1,
          senderUser: 1,
          replyToMessage: 1,
        },
      },
    ])
    .allowDiskUse(true)
    .exec();

  // Reverse to ascending (oldest → newest) for chat scroll view
  return messages.reverse();
}


  /**
   * Mark all messages in a room as read by a user.
   */
  async markAsRead(
    roomId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.messageModel.updateMany(
      { roomId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );

    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const unreadCounts = room.unreadCounts || new Map<string, number>();
    unreadCounts.set(userId, 0);
    room.unreadCounts = unreadCounts;

    await room.save();

    return { success: true };
  }
}
