// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ValidationPipe } from '@nestjs/common';
// import * as express from 'express';
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'redis';

// // import * as bodyParser from 'body-parser';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     }),
//   );
//   app.enableCors();
//   // app.use('/wallet/paystack/webhook', bodyParser.json({ verify: (req: any, res, buf) => {
//   //   req.rawBody = buf;
//   // }}));
//   app.use('/wallet/paystack/webhook', express.raw({ type: '*/*' }));

//   // Redis adapter setup
//   const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
//   const subClient = pubClient.duplicate();

//   await pubClient.connect();
//   await subClient.connect();

//   const redisAdapter = createAdapter(pubClient, subClient);
//   app.useWebSocketAdapter(new IoAdapter(app).createIOServer(0, { adapter: redisAdapter }));
//   await app.listen(9308);
//   console.log('app Listening at port 9308');
// }
// bootstrap();


import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { RedisIoAdapter } from 'adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();
  app.use('/wallet/paystack/webhook', express.raw({ type: '*/*' }));

  // use the custom adapter instance (do NOT call createIOServer here)
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisUrl));

  await app.listen(9308);
  console.log('app Listening at port 9308');
}
bootstrap();
