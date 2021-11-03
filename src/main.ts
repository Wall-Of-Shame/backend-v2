import { NestFactory } from '@nestjs/core';
import * as morgan from 'morgan';
import admin from 'firebase-admin';
import { AppModule } from './app.module';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const corsOptions: CorsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? [
          'https://www.wallofshame.io',
          'https://wall-of-shame-staging.netlify.app',
        ]
      : '*',
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: corsOptions,
  });
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  const port = configService.get('PORT');

  app.use(morgan('dev'));
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  await app.listen(port);
}

bootstrap();
