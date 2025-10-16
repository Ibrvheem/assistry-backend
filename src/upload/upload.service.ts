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
import sharp from 'sharp';
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

  // target max size in bytes (100 KB)
  private readonly MAX_BYTES = 60 * 1024;
  private readonly MAX_WIDTH = 1920; // limit width to avoid huge images
  private readonly MIN_QUALITY = 30; // do not go below this quality

  // helper: compress image buffer, return { buffer, format }
  private async compressImageBuffer(
    input: Buffer,
    maxBytes = this.MAX_BYTES
  ): Promise<{ buffer: Buffer; format: 'webp' | 'jpeg' | 'png' | 'avif' | 'original' }> {
    try {
      const meta = await sharp(input).metadata();

      // if not an image (no format) — return original
      if (!meta.format) {
        return { buffer: input, format: 'original' };
      }

      // only handle common raster images; for other formats fallback to original
      const imageFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
      if (!imageFormats.includes(meta.format)) {
        return { buffer: input, format: 'original' };
      }

      // If already small enough, short-circuit
      if (input.byteLength <= maxBytes) {
        return { buffer: input, format: meta.format as any };
      }

      // Start by resizing (if wide) and converting to webp for best compression
      const base = sharp(input).rotate().resize({ width: this.MAX_WIDTH, withoutEnlargement: true });

      // Try iterative quality reduction in WebP first
      for (let quality = 80; quality >= this.MIN_QUALITY; quality -= 10) {
        const out = await base.webp({ quality, effort: 4 }).toBuffer();
        if (out.byteLength <= maxBytes) {
          return { buffer: out, format: 'webp' };
        }
      }

      // If WebP didn't reach target, try JPEG (sometimes better for photos)
      for (let quality = 80; quality >= this.MIN_QUALITY; quality -= 10) {
        const out = await base.jpeg({ quality, mozjpeg: true }).toBuffer();
        if (out.byteLength <= maxBytes) {
          return { buffer: out, format: 'jpeg' };
        }
      }

      // As a last attempt, try AVIF (best compression but CPU heavier)
      try {
        for (let quality = 60; quality >= 30; quality -= 10) {
          const out = await base.avif({ quality }).toBuffer();
          if (out.byteLength <= maxBytes) {
            return { buffer: out, format: 'avif' };
          }
        }
      } catch (e) {
        // AVIF may not be available on all platforms/builds — ignore errors
        // console.warn('avif compress failed', e);
      }

      // If none succeeded, return the best (smallest) of the WebP/JPEG attempts.
      // We will pick the smallest by re-generating with a modest quality.
      const fallback = await base.webp({ quality: this.MIN_QUALITY, effort: 4 }).toBuffer();
      return { buffer: fallback, format: 'webp' };
    } catch (err) {
      // If any error (e.g., buffer not an image), return original
      console.warn('compressImageBuffer failed, uploading original. Error:', err);
      return { buffer: input, format: 'original' };
    }
  }

  /**
   * Upload a Buffer to Cloudinary.
   * @param filePath - a path-like identifier you want to use as public_id, e.g. 'folder/name.jpg' or 'avatars/user123'
   * @param file - Buffer
   */
  // async upload({ filePath, file }: { filePath: string; file: Buffer }) {
  //   // Cloudinary uses public_id (can contain slashes to emulate folders).
  //   const publicId = filePath.replace(/\.[^/.]+$/, ''); // drop extension if provided

  //   try {
  //     const result = await new Promise<any>((resolve, reject) => {
  //       const uploadStream = cloudinary.uploader.upload_stream(
  //         {
  //           public_id: publicId,
  //           resource_type: 'auto', // supports images, videos, etc.
  //           overwrite: true,
  //         },
  //         (error, result) => {
  //           if (error) return reject(error);
  //           resolve(result);
  //         },
  //       );
  //       streamifier.createReadStream(file).pipe(uploadStream);
  //     });

  //     return {
  //       success: true,
  //       key: result.public_id,      // use this to reference the file later
  //       url: result.secure_url,    // direct delivery URL from Cloudinary
  //       raw: result,               // full Cloudinary response if you need it
  //     };
  //   } catch (err) {
  //     console.error('Cloudinary upload error:', err);
  //     throw new Error('File upload failed');
  //   }
  // }

  async upload({ filePath, file }: { filePath: string; file: Buffer }) {
    // prepare public id (drop extension if present)
    const publicId = filePath.replace(/\.[^/.]+$/, '');

    // Try compressing the image; if not image it will return original buffer
    const { buffer: processedBuffer, format } = await this.compressImageBuffer(file);

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'auto',
            overwrite: true,
            // optional: let cloudinary store extension inferred from uploaded bytes
            // you could also pass e.g. format: 'webp' if you want to force it
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        // stream processed buffer to cloudinary
        streamifier.createReadStream(processedBuffer).pipe(uploadStream);
      });

      return {
        success: true,
        key: result.public_id,
        url: result.secure_url,
        raw: result,
        // include metadata to help client know the format & size
        uploadedFormat: format,
        uploadedSize: processedBuffer.byteLength,
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
