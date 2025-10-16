import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { CreateTaskDto } from './dto/create-task.dto'
import { UpdateTaskDto } from './dto/update-task.dto'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Task, TaskStatus } from './task.schema'
import { UsersService } from 'src/users/users.service'
import { SUCCESS } from 'constants/CustomResponses'
import { convertToKobo } from 'lib/helpers'
import { NotFound } from '@aws-sdk/client-s3'
import { response } from 'express'
import { UploadService } from 'src/upload/upload.service'
import { WalletService } from 'src/wallet/wallet.service'
import { TransactionType } from 'src/wallet/schemas/transaction.schema'
import { CreateTransactionDto } from 'src/wallet/dto/create-transaction.dto'

@Injectable()
export class TasksService {
  constructor (
    @InjectModel('Tasks') private readonly taskModel: Model<Task>,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly uploadService: UploadService,
  ) {}
  async create (id: string, payload: CreateTaskDto) {
    const user = await this.usersService.getMe(id)
    if (!user) {
      throw new NotFoundException(
        `User's id: ${id} is either incorrect or notfound`,
      )
    }
    try {
      const data = {
        ...payload,
        incentive: convertToKobo(payload.incentive),
        user_id: id,
      }
      const response = await this.taskModel.create(data)
      return SUCCESS
    } catch (err) {
      console.error(`There was an error creating task: ${err}`)
    }
  }

  async getYours (userId: string) {
    try {
      const response = await this.taskModel.find({
        user_id: userId,
      }).sort({ updated_at: -1 })
      const tasks = await Promise.all(
        response.map(async res => {
          console.log('Assets length:', res.assets.length)
          const assets =
            res.assets.length > 0
              ? await Promise.all(
                  res.assets.map(async asset => ({
                    ...asset.toObject(), // ✅ Converts subdocument to plain object
                    url: await this.uploadService.getFileUrl(
                      asset.assetStorageKey,
                    ),
                  })),
                )
              : []
          console.log('Assets with URLs:', assets)

          return { ...res.toObject(), assets }
        }),
      )
      console.log('Final tasks with assets:', tasks)

      return tasks
    } catch (err) {
      console.error(`There was an error fetching tasks: ${err}`)
      throw new InternalServerErrorException(
        'An error occurred while fetching tasks.',
      )
    }
  }

  async forYou (userId: string) {
    try {
      const response = await this.taskModel
        .find({
          // user_id: { $ne: userId },
          status: TaskStatus.PENDING,
        })
        .sort({ created_at: -1 })

      const tasks = await Promise.all(
        response.map(async res => {
          const user = await this.usersService.findUserByID(res.user_id)
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async asset => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      }
                    }),
                  )
                : [],
            user,
          }
        }),
      )

      return tasks
    } catch (err) {
      console.error(`There was an error fetching tasks: ${err}`)
      throw err // Re-throw error for higher-level handling if needed
    }
  }
  async getAvailableTask (userId: string) {
    try {
      const response = await this.taskModel.findOne({
        user_id: { $ne: userId },
        status: TaskStatus.PENDING,
      })

      return response
    } catch (err) {
      console.error('There was an error fetching active tasks', err)
    }
  }

  async getongoingTask(userId: string) {
    try {
      const response = await this.taskModel.find({
  $or: [{ acceptedBy: userId }, { user_id: userId }],
  status: { $in: [TaskStatus.ONGOING, TaskStatus.FINISHED] },
});

console.log('Ongoing tasks response:', response);

const tasks = await Promise.all(
        response.map(async res => {
          const user = await this.usersService.findUserByID(res.user_id)
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async asset => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      }
                    }),
                  )
                : [],
            user,
          }
        }),
      )


      return tasks;
    } catch (err) {
      console.error('There was an error fetching active tasks', err)
    }
  }

  async getYourTodo (userId: string) {
    try {
      const response = await this.taskModel.find({
        acceptedBy: userId,
        status: TaskStatus.ACCEPTED,
      }).sort({ created_at: -1 })

      const tasks = await Promise.all(
        response.map(async res => {
          const user = await this.usersService.findUserByID(res.user_id)
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async asset => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      }
                    }),
                  )
                : [],
            user,
          }
        }),
      )
      return tasks
    } catch (err) {
      console.error('There was an error fetching active tasks', err)
      throw new InternalServerErrorException(
        'An error occurred while fetching your todo tasks.',
      )
    }
  }
  async yourTaskAcceptedByOthers (userId: string) {
    try {
      const response = await this.taskModel.find({
        user_id: userId,
        status: TaskStatus.ACCEPTED,
      })

      const tasks = await Promise.all(
        response.map(async res => {
          const user = await this.usersService.findUserByID(res.acceptedBy)
          return {
            ...res.toObject(),
            assets:
              res.assets.length > 0
                ? await Promise.all(
                    res.assets.map(async asset => {
                      return {
                        ...asset.toObject(),
                        url: await this.uploadService.getFileUrl(
                          asset.assetStorageKey,
                        ),
                      }
                    }),
                  )
                : [],
            user,
          }
        }),
      )
      return tasks
    } catch (err) {
      console.error('There was an error fetching active tasks', err)
      throw new InternalServerErrorException(
        'An error occurred while fetching your todo tasks.',
      )
    }
  }

  async acceptTask (userId: string, id: string) {
    try {
      // Find the task that is not already accepted and matches the provided ID
      const task = await this.taskModel.findOne({
        _id: id,
        user_id: { $ne: userId },
        status: { $in: [TaskStatus.PENDING, TaskStatus.DECLINED] },
      })

      if (!task) {
        throw new NotFoundException(
          `Accept Task: Task with id: ${id} not found or has already been accepted.`,
        )
      }

      // Update the task to accepted status
      await this.taskModel.updateOne(
        { _id: id },
        { status: TaskStatus.ACCEPTED, acceptedBy: userId },
      )

      return SUCCESS
    } catch (err) {
      console.error(`Error while accepting task`, err)
      throw new InternalServerErrorException(
        'An error occurred while accepting the task.',
      )
    }
  }

  async cancelTask (userId: string, id: string) {
    try {
      // Find the task that is not already accepted and matches the provided ID
      const task = await this.taskModel.findOne({
        _id: id,
        user_id: userId,
        status: { $ne: TaskStatus.ONGOING }, //NOTE TO SELF: DO WE WANT TO ALLOW USERS TO CANCEL REQUEST THAT HAS ALREADY BEEN ACCEPTED AND IS IN PROGRESSS
      })

      if (!task) {
        throw new NotFoundException(
          `Cancel Task: Task with id: ${id} not found or Ongoing.`,
        )
      }

      // Update the task to accepted status
      await this.taskModel.updateOne(
        { _id: id },
        { status: TaskStatus.CANCELED },
      )

      return SUCCESS
    } catch (err) {
      console.error(`Error while cancelling  task`, err)
      throw new InternalServerErrorException(
        'An error occurred while cancelling  the task.',
      )
    }
  }

  async declineTask (userId: string, id: string) {
    try {
      const task = await this.taskModel.findOne({
        // user_id: { $ne: userId },
        $or: [{ acceptedBy: userId }, { user_id: userId }],
        status: TaskStatus.ACCEPTED,
        // acceptedBy: userId,
      })
      if (!task) {
        throw new NotFoundException(
          `Decline Task: Task with id: ${id} not found among your accepted tasks.`,
        )
      }
      await this.taskModel.updateOne(
        {
          _id: id,
        },
        {
          status: TaskStatus.DECLINED,
          declinedBy: [...task.declinedBy, userId],
        },
      )
      return SUCCESS
    } catch (err) {
      console.error(`Error while accepting task`, err)
      throw err
    }
  }

  async completeTask (userId: string, id: string) {
    try {
      const task = await this.taskModel.findOne({
        user_id: { $ne: userId },
        // $or: [{ acceptedBy: userId }, { user_id: userId }],
        status: TaskStatus.ONGOING,
        acceptedBy: userId,
      })
      if (!task) {
        throw new NotFoundException(
          `Decline Task: Task with id: ${id} not found among your accepted tasks.`,
        )
      }
      await this.taskModel.updateOne(
        {
          _id: id,
        },
        {
          status: TaskStatus.FINISHED,
        },
      )
      return SUCCESS
    } catch (err) {
      console.error(`Error while accepting task`, err)
      throw err
    }
  }

  async startTask (userId: string, id: string) {
    try {
      const task = await this.taskModel.findOne({
        user_id: { $ne: userId },
        status: TaskStatus.ACCEPTED,
        acceptedBy: userId,
      })
      if (!task) {
        throw new NotFoundException(
          `Decline Task: Task with id: ${id} not found among your accepted tasks.`,
        )
      }
      await this.taskModel.updateOne(
        {
          _id: id,
        },
        {
          status: TaskStatus.ONGOING,
        },
      )
      return SUCCESS
    } catch (err) {
      console.error(`Error while STARTING task`, err)
      throw err
    }
  }

  async acknowledgeTask (userId: string, id: string) {
    try {
      const task = await this.taskModel.findOne({
        _id: id,
        user_id: userId,
        status: TaskStatus.FINISHED,
      })
      if (!task) {
        throw new NotFoundException(
          `Decline Task: Task with id: ${id} not found among tasks finished my assister.`,
        )
      }
      await this.taskModel.updateOne(
        {
          _id: id,
        },
        {
          status: TaskStatus.COMPLETED,
        },
      )
      try {
        const reference = await this.walletService.reference_generator(
          task.task.slice(0, 7),
        )
        const amount_kobo = task.incentive

        // Debit transaction (user paying)
        const debitDto: CreateTransactionDto = {
          type: TransactionType.DEBIT,
          amount_kobo,
          reference,
        }
        await this.walletService.createTransaction(userId, debitDto)

        // Credit transaction (receiver)
        const creditReference = await this.walletService.reference_generator(
          task.task.slice(0, 7),
        )
        const creditDto: CreateTransactionDto = {
          type: TransactionType.CREDIT,
          amount_kobo,
          reference: creditReference,
        }
        await this.walletService.createTransaction(task.acceptedBy, creditDto)

        return SUCCESS
      } catch (error) {
        console.error('Transaction failed:', error)
        throw error
      }
    } catch (err) {
      console.error(`Error while acknowledging task`, err)
      throw err
    }
  }

  findAll () {
    return `This action returns all tasks`
  }

  async findOne (id: string, currentUserId: string) {
    try {
      const task = await this.taskModel.findById({
        _id: id,
      })
      if (!task) {
        throw new NotFoundException(`Get One: Task with ${id} not found `)
      }

      const user = await this.usersService.findUserByID(task.user_id)
      const assets =
        task.assets.length > 0
          ? await Promise.all(
              task.assets.map(async asset => {
                return {
                  ...asset.toObject(),
                  url: await this.uploadService.getFileUrl(
                    asset.assetStorageKey,
                  ),
                }
              }),
            )
          : []

      const hasViewed = task.viewedBy.some(
        viewerId => viewerId.toString() === currentUserId,
      )

      // If not viewed before, increment views and save viewer
      if (!hasViewed) {
        task.views += 1
        task.viewedBy.push(currentUserId)
        await task.save()
      }
      console.log('Views count:', task.views)
      // add to nimber of views (note: 1 view per user, if user call api call multiple times, it still counts as 1 view)
      return { ...task.toObject(), assets, user }
      return task
    } catch (err) {
      throw new InternalServerErrorException(err)
    }
  }

  // async update (id: number, userId:string, updateTaskDto: UpdateTaskDto) {
  //   console.log('Update DTO:',updateTaskDto)
  //   const task = await this.taskModel.findOne({
  //       _id: id, user_id:userId
  //     })
  //     if (!task) {
  //       throw new NotFoundException(`Get One: Task with ${id} not found `)
  //     }
  //   return SUCCESS;
  // }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto) {


  // make sure the task exists and belongs to this user
  const existing = await this.taskModel.findOne({ _id: id, user_id: userId });
  if (!existing) {
    throw new NotFoundException(`Task with id ${id} not found or you don't have permission to edit it`);
  }

  // prepare payload: shallow copy so we don't mutate DTO unexpectedly
  const payload: any = { ...updateTaskDto };

  // If incentive provided, convert to kobo (guard for string/number)
  if (payload.incentive !== undefined && payload.incentive !== null && payload.incentive !== '') {
    // If incentive could be a string in DTO, coerce to number first
    const incentiveNum = Number(payload.incentive);
    if (Number.isNaN(incentiveNum)) {
      throw new BadRequestException('Invalid incentive value');
    }
    payload.incentive = convertToKobo(incentiveNum);
  }

  // If expires is provided and should be a Number, coerce/validate
  if (payload.expires !== undefined && payload.expires !== null && payload.expires !== '') {
    const expiresNum = Number(payload.expires);
    if (Number.isNaN(expiresNum)) {
      // optionally accept a Date string -> convert to timestamp
      // throw or convert depending on your domain rules
      throw new BadRequestException('Invalid expires value');
    }
    payload.expires = expiresNum;
  }

  // remove undefined keys (optional but cleaner)
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  try {
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: id, user_id: userId }, // ownership check
      { $set: payload },
      { new: true } // return updated document
    );

    if (!updated) {
      // race condition: wasn't found for update
      throw new NotFoundException(`Task with id ${id} not found or you don't have permission to edit it`);
    }

    console.log(`Task ${id} updated successfully`);

    // return whatever your API expects — you returned SUCCESS in create, keep consistent
    return SUCCESS;
    
    // or return updated if you prefer:
    // return updated;
  } catch (err) {
    console.error(`There was an error updating task ${id}:`, err);
    throw new InternalServerErrorException('Failed to update task');
  }
}

  remove (id: number) {
    return `This action removes a #${id} task`
  }
}
