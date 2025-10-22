import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { StoreModule } from '../store/store.module';
import { EventsModule } from '../events/events.module';
import { ArizeModule } from '../arize/arize.module';

@Module({
  imports: [StoreModule, EventsModule, ArizeModule],
  controllers: [ProxyController],
})
export class ProxyModule {}

