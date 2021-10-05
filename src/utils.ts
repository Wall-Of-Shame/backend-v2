import { Socket } from 'net';

// interface to handle the ConnectedSocket typing
export interface CSocket extends Socket {
  handshake: {
    user: {
      userId: string;
    };
  };
}
