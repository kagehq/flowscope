import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const useSocket = () => {
  if (!socket) {
    socket = io(`${useApiBase()}/ws`, { transports: ['websocket'] });
  }
  return socket;
};

