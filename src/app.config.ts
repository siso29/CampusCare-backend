import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
