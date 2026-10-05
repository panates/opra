import { ApiDocument, ApiDocumentFactory } from '@opra/common';
import { SocketioAdapter } from '@opra/socketio';
import { MainController } from './api/main-controller.js';
import { RoomController } from './api/room-controller.js';
import { Room } from './models/room.js';
import { RoomOptions } from './models/room-options.js';
import { RoomsService } from './services/rooms.service.js';

export class ChatApp {
  declare adapter: SocketioAdapter;
  declare document: ApiDocument;
  declare roomService: RoomsService;

  constructor() {
    this.roomService = new RoomsService(this);
  }

  async start() {
    this.document = await ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        description:
          'Sample Opra WebSocket API demonstrating a chat application with rooms',
        termsOfService: 'https://panates.com/terms-of-service',
        contact: [
          {
            name: 'Panates',
            email: 'info@panates.com',
            url: 'https://panates.com',
          },
        ],
        license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
      },
      types: [RoomOptions, Room],
      api: {
        name: 'ChatApi',
        transport: 'ws',
        controllers: [new MainController(this), new RoomController(this)],
      },
    });
    this.adapter = new SocketioAdapter(this.document, {
      scope: 'api',
    } as SocketioAdapter.Options);
    this.adapter.server.use((socket, next) => {
      const user = socket.handshake.auth.token;
      if (user) {
        socket.data = {
          user,
        };
        next();
      } else {
        next(new Error('Unauthorized'));
      }
    });
    this.adapter.listen(6001);
  }
}

export const app = new ChatApp();
