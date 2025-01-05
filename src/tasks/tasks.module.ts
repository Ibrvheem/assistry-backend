import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskSchema } from './task.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [TasksController],
  providers: [TasksService, UsersModule],
  imports: [
    MongooseModule.forFeature([{ name: 'Tasks', schema: TaskSchema }]),
    UsersModule,
  ],
})
export class TasksModule {}