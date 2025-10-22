import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [StoreModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}

