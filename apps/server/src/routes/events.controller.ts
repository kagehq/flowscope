import { Controller, Get, Param, Query } from '@nestjs/common';
import { CaptureStore } from '../store/capture.store';
import { HttpMethod } from '@flowscope/shared';

@Controller('events')
export class EventsController {
  constructor(private store: CaptureStore) {}

  @Get()
  list(
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('pathIncludes') pathIncludes?: string,
    @Query('q') q?: string,
    @Query('sinceTs') sinceTs?: string
  ) {
    const methods = method ? (method.split(',') as HttpMethod[]) : undefined;
    const statuses = status ? status.split(',').map(Number) : undefined;
    return this.store.list({
      method: methods,
      status: statuses,
      pathIncludes,
      q,
      sinceTs: sinceTs ? Number(sinceTs) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.store.get(id);
  }
}

