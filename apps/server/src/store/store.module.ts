import { Module } from '@nestjs/common';
import { CaptureStore } from './capture.store';

@Module({
  providers: [CaptureStore],
  exports: [CaptureStore],
})
export class StoreModule {}

