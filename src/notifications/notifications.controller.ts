import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Public } from 'decorators/public.decorator';
import { UsersService } from 'src/users/users.service';
import { REGSTATUS } from 'src/users/types';

@Controller('notifications')
@Public()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly userService: UsersService,
  ) {}

  @Post('/test')
  async createNotification(@Body() body: { userId: string }) {
    return this.notificationsService.sendPushNotification(
      body.userId,
      'Test',
      'Test',
    );
  }
}
