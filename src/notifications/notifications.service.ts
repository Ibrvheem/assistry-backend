import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/user.schema';

@Injectable()
export class NotificationsService {
  private expo = new Expo();
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: any = {},
  ) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user || !user.push_token) {
        this.logger.warn(`User ${userId} has no push token.`);
        return;
      }

      if (!Expo.isExpoPushToken(user.push_token)) {
        this.logger.error(
          `Push token ${user.push_token} is not a valid Expo push token`,
        );
        return;
      }

      const messages: ExpoPushMessage[] = [];
      messages.push({
        to: user.push_token,
        sound: 'default',
        title,
        body,
        data,
      });

      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error('Error sending push notification chunk', error);
        }
      }

      this.logger.log(`Push notification sent to ${userId}: ${title}`);
      return tickets;
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${userId}`, error);
    }
  }
}
