import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
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
  async findOrCreateRoom(creatorId: string, dto: CreateRoomDto): Promise<any> {
    const participantsSet = new Set<string>([
      creatorId,
      ...(dto.participants || []),
    ]);
    if (participantsSet.size < 2) {
      throw new BadRequestException(
        'At least two distinct participants required',
      );
    }

    const participants = Array.from(participantsSet).sort();
    const participantsKey = participants.join('_');

    // Check for existing room
    let room = await this.roomModel
      .findOne({ taskId: dto.taskId, participantsKey })
      .lean<Lean<ChatRoom>>();

    // Create if not exists
    if (!room) {
      const task = await this.taskService.findOne101(dto.taskId);
      if (!task) {
        throw new NotFoundException('Task not found');
      }

      const created = await this.roomModel.create({
        name: task.task.slice(0, 20),
        taskId: dto.taskId,
        participants,
        participantsKey,
        task_picture: task.assets.length > 0 ? task.assets[0].url : null,
      });

      room = created.toObject() as Lean<ChatRoom>;
    }

    const roomId =
      room._id instanceof Types.ObjectId
        ? room._id
        : new Types.ObjectId(room._id.toString());

    // Enrich it
    const [enriched] = await this.roomModel
      .aggregate([
        { $match: { _id: roomId } },
        // Users
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'users',
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
        // Unread Count
        {
          $addFields: {
            unreadCount: {
              $ifNull: [
                {
                  $toInt: {
                    $getField: { field: creatorId, input: '$unreadCounts' },
                  },
                },
                0,
              ],
            },
          },
        },
        // Final shape
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

    return enriched;
  }

  /**
   * Retrieve chat rooms for a given user.
   */
  async getRoomsForUser(userId: string, limit = 20, skip = 0): Promise<any[]> {
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
        { $unwind: { path: '$lastMessage' } },

        // Compute unreadCount dynamically
        {
          $addFields: {
            unreadCount: {
              $ifNull: [
                {
                  $toInt: {
                    $getField: { field: userId, input: '$unreadCounts' },
                  },
                },
                0,
              ],
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

  /**
   * Create and persist a new chat message.
   */
  async createMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<Lean<Message>> {
    const room = await this.roomModel.findById(dto.roomId).lean();
    if (!room) throw new NotFoundException('Room not found');

    if (!room.participants.map(String).includes(String(senderId))) {
      throw new BadRequestException('Sender is not a participant of the room');
    }

    // Validate replyTo if provided
    if (dto.replyTo) {
      const replyToDoc = await this.messageModel.findById(dto.replyTo).lean();
      if (!replyToDoc)
        throw new BadRequestException('Replied message not found');
      if (replyToDoc.roomId.toString() !== dto.roomId.toString()) {
        throw new BadRequestException(
          'Cannot reply to a message from another room',
        );
      }
    }

    // Create the message
    const message = await this.messageModel.create({
      roomId: dto.roomId,
      sender: senderId,
      type: dto.type,
      text: dto.text,
      attachments: dto.attachments || [],
      readBy: [senderId],
      replyTo: dto.replyTo ?? null,
    });

    // Build unread counter increments
    const unreadIncrements = {};
    for (const participantId of room.participants.map(String)) {
      if (participantId !== String(senderId)) {
        unreadIncrements[`unreadCounts.${participantId}`] = 1;
      }
    }

    // Perform atomic update on the room
    await this.roomModel.findByIdAndUpdate(
      dto.roomId,
      {
        $set: { lastMessageAt: message.createdAt },
        $inc: unreadIncrements,
      },
      { new: false },
    );

    return message.toObject() as Lean<Message>;
  }

  /**
   * Fetch messages for a room (paginated, newest first).
   */
  async getMessages(
    roomId: string,
    limit = 50,
    before?: string,
  ): Promise<any[]> {
    const query: any = {
      roomId: new Types.ObjectId(roomId),
    };

    if (before) query._id = { $lt: new Types.ObjectId(before) };

    const messages = await this.messageModel
      .aggregate([
        { $match: query },
        { $sort: { _id: -1 } },
        { $limit: limit },
        // Join sender user
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
        { $unwind: '$senderUser' },
        // Lookup replyTo message
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
              {
                $unwind: {
                  path: '$senderUser',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$replyToMessage',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Final lean projection
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

  /**
   * Get changes for WatermelonDB sync.
   */
  async getChanges(userId: string, lastPulledAt: number) {
    const date = new Date(lastPulledAt);

    // 1. Get updated rooms
    const rooms = (await this.roomModel
      .find({
        participants: userId,
        updatedAt: { $gt: date },
      })
      .populate('participants', 'first_name last_name profile_picture')
      .lean()) as any[];

    // 2. Get updated messages
    const userRooms = await this.roomModel
      .find({ participants: userId })
      .select('_id');
    const roomIds = userRooms.map((r) => r._id);

    const messages = (await this.messageModel
      .find({
        roomId: { $in: roomIds },
        createdAt: { $gt: date },
      })
      .lean()) as any[];

    return {
      conversations: {
        created: rooms.map((r) => {
          const otherUser = r.participants.find(
            (p: any) => p._id.toString() !== userId,
          );
          const name =
            r.name ||
            (otherUser
              ? `${otherUser.first_name} ${otherUser.last_name}`
              : 'Unknown');
          const avatar =
            r.avatar || (otherUser ? otherUser.profile_picture : '');

          return {
            id: r._id.toString(),
            name,
            avatar,
            created_at: new Date(r.createdAt).getTime(),
            updated_at: new Date(r.updatedAt).getTime(),
            last_message_id: null,
            unread_count: r.unreadCounts?.get(userId) || 0,
          };
        }),
        updated: [],
        deleted: [],
      },
      messages: {
        created: messages.map((m) => ({
          id: m._id.toString(),
          conversation_id: m.roomId.toString(),
          sender_id: m.sender.toString(),
          content: m.text,
          type: m.type,
          status: 'delivered',
          created_at: new Date(m.createdAt).getTime(),
          attachments: JSON.stringify(m.attachments || []),
          reply_to: JSON.stringify(m.replyTo || null),
        })),
        updated: [],
        deleted: [],
      },
    };
  }

  /**
   * Apply changes from WatermelonDB push.
   */
  async applyChanges(userId: string, changes: any) {
    if (changes.messages?.created) {
      for (const msg of changes.messages.created) {
        await this.createMessage(userId, {
          roomId: msg.conversation_id,
          text: msg.content,
          type: msg.type,
          // attachments: [],
        });
      }
    }
  }

  async updateMessageStatus(messageId: string, status: 'delivered' | 'seen') {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      { status, seenAt: status === 'seen' ? new Date() : undefined },
      { new: true },
    );
  }
}
