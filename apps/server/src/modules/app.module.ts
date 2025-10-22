import { Module } from '@nestjs/common';
import { ProxyModule } from '../proxy/proxy.module';
import { StoreModule } from '../store/store.module';
import { EventsModule } from '../events/events.module';
import { EventsController } from '../routes/events.controller';
import { HealthController } from '../routes/health.controller';
import { ReplayController } from '../routes/replay.controller';

@Module({
  imports: [StoreModule, EventsModule, ProxyModule],
  controllers: [EventsController, HealthController, ReplayController],
})
export class AppModule {}

