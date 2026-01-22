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
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('/test')
  async createNotification(
    @Body() body: { userId?: string; pushToken?: string },
  ) {
    if (body.pushToken) {
      // Direct token test
      return this.notificationsService.sendPushNotificationByToken(
        body.pushToken,
        'Test Notification',
        'This is a direct test notification!',
      );
    }
    return this.notificationsService.sendPushNotification(
      body.userId,
      'Test',
      'Test',
    );
  }
}
