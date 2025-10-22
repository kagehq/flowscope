import { Module } from '@nestjs/common';
import { ProxyModule } from '../proxy/proxy.module';
import { StoreModule } from '../store/store.module';
import { EventsModule } from '../events/events.module';
import { EventsController } from '../routes/events.controller';
import { HealthController } from '../routes/health.controller';
import { ReplayController } from '../routes/replay.controller';
import { StatsController } from '../routes/stats.controller';
import { MockController } from '../routes/mock.controller';
import { SessionsController } from '../routes/sessions.controller';

@Module({
  imports: [StoreModule, EventsModule, ProxyModule],
  controllers: [
    EventsController,
    HealthController,
    ReplayController,
    StatsController,
    MockController,
    SessionsController,
  ],
})
export class AppModule {}

