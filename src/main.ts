import { NestFactory } from '@nestjs/core';
import admin from 'firebase-admin';
import { AppModule } from './app.module';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // see env check above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
