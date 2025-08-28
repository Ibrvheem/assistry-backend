import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

// import * as bodyParser from 'body-parser';

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
  // app.use('/wallet/paystack/webhook', bodyParser.json({ verify: (req: any, res, buf) => {
  //   req.rawBody = buf;
  // }}));
  app.use('/wallet/paystack/webhook', express.raw({ type: '*/*' }));
  await app.listen(9308);
  console.log('app Listening at port 9308');
}
bootstrap();
