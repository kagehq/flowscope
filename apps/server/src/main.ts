import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import cors from 'cors';
import { json, urlencoded, raw, Request, Response, NextFunction } from 'express';

async function bootstrap() {
  // Disable body parsing globally - we'll handle it per route
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // CORS: Allow dashboard and any localhost origins in development
  const isDev = process.env.NODE_ENV !== 'production';

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        // In development: Allow all localhost/127.0.0.1 origins
        if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
          return callback(null, true);
        }

        // Allow configured origins (comma-separated in env)
        const allowedOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
          : ['http://localhost:4320'];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  // Enable body parsing ONLY for non-proxy routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/proxy')) {
      // Skip body parsing for proxy routes - we need the raw stream
      return next();
    }
    // Parse bodies for all other routes (API endpoints)
    return json({ limit: '50mb' })(req, res, (err: any) => {
      if (err) return next(err);
      urlencoded({ extended: true, limit: '50mb' })(req, res, next);
    });
  });

  await app.listen(Number(process.env.PORT || 4317));
  console.log(`[flowscope] server running on port :${process.env.PORT || 4317}`);
  if (isDev) {
    console.log(`[flowscope] CORS: allowing all localhost origins (dev mode)`);
  } else {
    console.log(`[flowscope] CORS: ${process.env.ALLOWED_ORIGINS || 'http://localhost:4320'}`);
  }
}

bootstrap();
