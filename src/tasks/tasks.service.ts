import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskStatus } from './task.schema';
import { UsersService } from 'src/users/users.service';
import { SUCCESS } from 'constants/CustomResponses';
import { convertToKobo } from 'lib/helpers';
import { NotFound } from '@aws-sdk/client-s3';
import { response } from 'express';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel('Tasks') private readonly taskModel: Model<Task>,
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}
  async create(id: string, payload: CreateTaskDto) {
    const user = await this.usersService.getMe(id);
    if (!user) {
      throw new NotFoundException(
        `User's id: ${id} is either incorrect or notfound`,
      );
    }
    try {
      const data = {
        ...payload,
        incentive: convertToKobo(payload.incentive),
        user_id: id,
      };
      const response = await this.taskModel.create(data);
      return SUCCESS;
    } catch (err) {
      console.error(`There was an error creating task: ${err}`);
    }
  }

  async getYours(userId: string) {
    try {
      const response = await this.taskModel.find({
        user_id: userId,
      });
      const tasks = await Promise.all(
        response.map(async (res) => {
          console.log('Assets length:', res.assets.length);
          const assets =
            res.assets.length > 0
              ? await Promise.all(
                  res.assets.map(async (asset) => ({
                    ...asset.toObject(), // ✅ Converts subdocument to plain object
                    url: await this.uploadService.getFileUrl(
                      asset.assetStorageKey,
                    ),
                  })),
                )
              : [];
          console.log('Assets with URLs:', assets);

          return { ...res.toObject(), assets };
        }),
      );
      console.log('Final tasks with assets:', tasks);

      return tasks;
    } catch (err) {
      console.error(`There was an error fetching tasks: ${err}`);
      throw new InternalServerErrorException(
        'An error occurred while fetching tasks.',
      );
    }
  }

  async forYou(userId: string) {
    try {
      const response = await this.taskModel.find({
        // user_id: { $ne: userId },
        status: TaskStatus.PENDING,
      }).sort({ created_at: -1 });

      const tasks = await Promise.all(
        response.map(async (res) => {
          const user = await this.usersService.findUserByID(res.user_id);
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async (asset) => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      };
                    }),
                  )
                : [],
            user,
          };
        }),
      );

      return tasks;
    } catch (err) {
      console.error(`There was an error fetching tasks: ${err}`);
      throw err; // Re-throw error for higher-level handling if needed
    }
  }
  async getAvailableTask(userId: string) {
    try {
      const response = await this.taskModel.findOne({
        user_id: { $ne: userId },
        status: TaskStatus.PENDING,
      });

      return response;
    } catch (err) {
      console.error('There was an error fetching active tasks', err);
    }
  }

  async getYourTodo(userId: string) {
    try {
      const response = await this.taskModel.find({
        acceptedBy: userId,
        status: TaskStatus.ACCEPTED,
      });

      const tasks = await Promise.all(
        response.map(async (res) => {
          const user = await this.usersService.findUserByID(res.user_id);
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async (asset) => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      };
                    }),
                  )
                : [],
            user,
          };
        }),
      );
      return tasks;
    } catch (err) {
      console.error('There was an error fetching active tasks', err);
      throw new InternalServerErrorException(
        'An error occurred while fetching your todo tasks.',
      );
    }
  }
  async yourTaskAcceptedByOthers(userId: string) {
    try {
      const response = await this.taskModel.find({
        user_id: userId,
        status: TaskStatus.ACCEPTED,
      });

      const tasks = await Promise.all(
        response.map(async (res) => {
          const user = await this.usersService.findUserByID(res.acceptedBy);
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async (asset) => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      };
                    }),
                  )
                : [],
            user,
          };
        }),
      );
      return tasks;
    } catch (err) {
      console.error('There was an error fetching active tasks', err);
      throw new InternalServerErrorException(
        'An error occurred while fetching your todo tasks.',
      );
    }
  }

  async acceptTask(userId: string, id: string) {
    try {
      // Find the task that is not already accepted and matches the provided ID
      const task = await this.taskModel.findOne({
        _id: id,
        user_id: { $ne: userId },
        status: { $in: [TaskStatus.PENDING, TaskStatus.DECLINED] },
      });

      if (!task) {
        throw new NotFoundException(
          `Accept Task: Task with id: ${id} not found or has already been accepted.`,
        );
      }

      // Update the task to accepted status
      await this.taskModel.updateOne(
        { _id: id },
        { status: TaskStatus.ACCEPTED, acceptedBy: userId },
      );

      return SUCCESS;
    } catch (err) {
      console.error(`Error while accepting task`, err);
      throw new InternalServerErrorException(
        'An error occurred while accepting the task.',
      );
    }
  }

  async cancelTask(userId: string, id: string) {
    try {
      // Find the task that is not already accepted and matches the provided ID
      const task = await this.taskModel.findOne({
        _id: id,
        user_id: userId,
        // status: { $ne: TaskStatus.ACCEPTED }, //NOTE TO SELF: DO WE WANT TO ALLOW USERS TO CANCEL REQUEST THAT HAS ALREADY BEEN ACCEPTED AND IS IN PROGRESSS
      });

      if (!task) {
        throw new NotFoundException(
          `Cancel Task: Task with id: ${id} not found or has already been accepted.`,
        );
      }

      // Update the task to accepted status
      await this.taskModel.updateOne(
        { _id: id },
        { status: TaskStatus.CANCELED },
      );

      return SUCCESS;
    } catch (err) {
      console.error(`Error while cancelling  task`, err);
      throw new InternalServerErrorException(
        'An error occurred while cancelling  the task.',
      );
    }
  }

  async declineTask(userId: string, id: string) {
    try {
      const task = await this.taskModel.findOne({
        user_id: { $ne: userId },
        status: TaskStatus.ACCEPTED,
        acceptedBy: userId,
      });
      if (!task) {
        throw new NotFoundException(
          `Decline Task: Task with id: ${id} not found among your accepted tasks.`,
        );
      }
      await this.taskModel.updateOne(
        {
          _id: id,
        },
        {
          status: TaskStatus.DECLINED,
          declinedBy: [...task.declinedBy, userId],
        },
      );
      return SUCCESS;
    } catch (err) {
      console.error(`Error while accepting task`, err);
      throw err;
    }
  }

  findAll() {
    return `This action returns all tasks`;
  }

  async findOne(id: string) {
    try {
      const task = await this.taskModel.findById({
        _id: id,
      });
      if (!task) {
        throw new NotFoundException(`Get One: Task with ${id} not found `);
      }

      const user = await this.usersService.findUserByID(task.user_id);
      const assets =
        task.assets.length > 0
          ? await Promise.all(
              task.assets.map(async (asset) => {
                return {
                  ...asset.toObject(),
                  url: await this.uploadService.getFileUrl(
                    asset.assetStorageKey,
                  ),
                };
              }),
            )
          : [];
      return { ...task.toObject(), assets, user };
      return task;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    return `This action updates a #${id} task`;
  }

  remove(id: number) {
    return `This action removes a #${id} task`;
  }
}
