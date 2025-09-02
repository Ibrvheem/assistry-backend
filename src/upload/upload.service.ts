// import { Injectable } from '@nestjs/common';
// import {
//   PutObjectCommand,
//   GetObjectCommand,
//   DeleteObjectCommand,
//   S3Client,
// } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class UploadService {
//   private readonly s3Client = new S3Client({
//     endpoint: this.configService.getOrThrow('R2_ENDPOINT'),
//     region: this.configService.getOrThrow('R2_REGION'),
//     credentials: {
//       accessKeyId: this.configService.getOrThrow('R2_ACCESS_KEY_ID'),
//       secretAccessKey: this.configService.getOrThrow('R2_SECRET_ACCESS_KEY'),
//     },
//   });

//   constructor(private readonly configService: ConfigService) {}

//   async upload({ filePath, file }: { filePath: string; file: Buffer }) {
//     try {
//       await this.s3Client.send(
//         new PutObjectCommand({
//           Bucket: 'assistry',
//           Key: filePath,
//           Body: file,
//         }),
//       );
//       return {
//         success: true,
//         key: filePath,
//       };
//     } catch (err) {
//       console.error('There was an error uploading file to S3:', err);
//       throw new Error('File upload failed');
//     }
//   }

//   async getFileUrl(filePath: string, expiresIn = 3600): Promise<string> {
//     try {
//       const command = new GetObjectCommand({
//         Bucket: 'assistry',
//         Key: filePath,
//       });

//       return await getSignedUrl(this.s3Client, command, { expiresIn });
//     } catch (err) {
//       console.error('Error generating file URL:', err);
//       throw new Error('Failed to generate file URL');
//     }
//   }

//   async deleteFile(filePath: string) {
//     try {
//       await this.s3Client.send(
//         new DeleteObjectCommand({
//           Bucket: 'assistry',
//           Key: filePath,
//         }),
//       );
//       return { success: true, message: 'File deleted successfully' };
//     } catch (err) {
//       console.error('There was an error deleting file from S3:', err);
//       throw new Error('File deletion failed');
//     }
//   }
// }


import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /**
   * Upload a Buffer to Cloudinary.
   * @param filePath - a path-like identifier you want to use as public_id, e.g. 'folder/name.jpg' or 'avatars/user123'
   * @param file - Buffer
   */
  async upload({ filePath, file }: { filePath: string; file: Buffer }) {
    // Cloudinary uses public_id (can contain slashes to emulate folders).
    const publicId = filePath.replace(/\.[^/.]+$/, ''); // drop extension if provided

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'auto', // supports images, videos, etc.
            overwrite: true,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        streamifier.createReadStream(file).pipe(uploadStream);
      });

      return {
        success: true,
        key: result.public_id,      // use this to reference the file later
        url: result.secure_url,    // direct delivery URL from Cloudinary
        raw: result,               // full Cloudinary response if you need it
      };
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      throw new Error('File upload failed');
    }
  }

  /**
   * Get a delivery URL for a public_id (filePath).
   * Cloudinary returns a permanent secure URL. If you need signed or private delivery, see notes below.
   */
  async getFileUrl(filePath: string, opts?: { signUrl?: boolean }) {
    const publicId = filePath.replace(/\.[^/.]+$/, '');

    try {
      // signUrl: if true, Cloudinary will add a signature component to protect transformations
      const url = cloudinary.url(publicId, {
        resource_type: 'auto',
        secure: true,
        sign_url: opts?.signUrl ?? false,
      } as any);
      return url;
    } catch (err) {
      console.error('Error generating Cloudinary URL:', err);
      throw new Error('Failed to generate file URL');
    }
  }

  /**
   * Delete a file (destroy by public_id).
   */
  async deleteFile(filePath: string) {
    const publicId = filePath.replace(/\.[^/.]+$/, '');

    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
      return { success: true, result };
    } catch (err) {
      console.error('Cloudinary delete error:', err);
      throw new Error('File deletion failed');
    }
  }
}
