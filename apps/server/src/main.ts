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
  
  // Allow both the dashboard and any frontend apps
  const allowedOrigins = [
    process.env.DASHBOARD_ORIGIN || 'http://localhost:4320',
    'http://localhost:3001', // Nuxt/frontend dev server
    'http://localhost:3000', // Alternative frontend port
  ];
  
  app.use(
    cors({
      origin: allowedOrigins,
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
  console.log(`[flowscope] CORS enabled for:`, allowedOrigins);
}

bootstrap();
