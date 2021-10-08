import { Socket } from 'socket.io';

export class WsLogger {
  log(socket: Socket, eventName: string, flag: 'EMIT' | 'RECEIVE', data?: any) {
    console.log(`SOCKET: ${socket.id}` + ` || ${flag}: '${eventName}'`);
    if (data) {
      console.log('Data', data);
    }
  }
}
