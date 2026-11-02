import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const origin = request.get('origin');
    if (!origin) return next();

    const allowedOrigins = (
      process.env.FRONTEND_ORIGIN || 'http://localhost:3000'
    )
      .split(',')
      .map((value) => value.trim());
    if (!allowedOrigins.includes(origin)) {
      return response.status(403).json({
        statusCode: 403,
        message: 'Request origin is not allowed',
      });
    }
    return next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
