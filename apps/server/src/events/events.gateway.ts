import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CaptureStore } from '../store/capture.store';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: [process.env.DASHBOARD_ORIGIN || 'http://localhost:4320'],
  },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(private store: CaptureStore) {}

  handleConnection(client: any) {
    client.emit('events:rehydrate', this.store.list().slice(0, 100));
  }

  emitNew(event: any) {
    this.server.emit('events:new', event);
  }
}

