import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    cors({
      origin: [process.env.DASHBOARD_ORIGIN || 'http://localhost:4320'],
      credentials: true,
    })
  );
  await app.listen(Number(process.env.PORT || 4317));
  console.log(`[flowscope] server running on port :${process.env.PORT || 4317}`);
}

bootstrap();

