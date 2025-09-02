// import {
//   Controller,
//   UseInterceptors,
//   UploadedFile,
//   Post,
// } from '@nestjs/common';
// import { UploadService } from './upload.service';
// import { FileInterceptor } from '@nestjs/platform-express';
import { User } from 'decorators/user.decorator';

import { Public } from 'decorators/public.decorator';

// @Public()
// @Controller('upload')
// export class UploadController {
//   constructor(private readonly uploadService: UploadService) {}

//   @Post()
//   @UseInterceptors(FileInterceptor('file'))
//   async uploadFile(@User() user, @UploadedFile() file: Express.Multer.File) {
//     const filePath = `${user.userId}/${file.originalname}`;
//     const response = await this.uploadService.upload({
//       filePath,
//       file: file.buffer,
//     });
//     return response;
//   }
// }


import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
// import { User } from '../common/decorators/user.decorator'; // your decorator
// import { Public } from '../common/decorators/public.decorator';

@Public()            // remove this if you want auth
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // <--- ensures `file.buffer` is present
      limits: { fileSize: 10 * 1024 * 1024 }, // optional: 10 MB limit
    }),
  )
  async uploadFile(@User() user: any, @UploadedFile() file: Express.Multer.File) {
    const userId = user?.userId ?? 'anonymous'; // fallback if route is public
    const filePath = `${userId}/${file.originalname}`;
    const response = await this.uploadService.upload({
      filePath,
      file: file.buffer,
    });
    return response;
  }
}
