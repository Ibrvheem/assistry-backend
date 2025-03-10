import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { User } from 'decorators/user.decorator';
import { Public } from 'decorators/public.decorator';

@Public()
@Controller('/')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(@User() user): Promise<string> {
    return await this.appService.getHello();
  }
}
