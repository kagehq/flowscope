import { Module } from '@nestjs/common';
import { ArizeService } from './arize.service';

@Module({
  providers: [ArizeService],
  exports: [ArizeService],
})
export class ArizeModule {}

