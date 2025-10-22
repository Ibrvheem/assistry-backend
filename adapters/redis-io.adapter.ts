// // src/adapters/redis-io.adapter.ts
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { INestApplication } from '@nestjs/common';
// import { ServerOptions, Server } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient, RedisClientType } from 'redis';

// export class RedisIoAdapter extends IoAdapter {
//   private pubClient?: RedisClientType;
//   private subClient?: RedisClientType;

//   constructor(private app: INestApplication, private redisUrl = 'redis://localhost:6379') {
//     super(app);
//   }

//   // override so we can attach the redis adapter to the server instance
//   async createIOServer(port: number, options?: ServerOptions): Promise<Server> {
//     // let the base class create the socket.io Server
//     const server = await super.createIOServer(port, options);

//     // create pub/sub clients (lazily, once)
//     if (!this.pubClient || !this.subClient) {
//       this.pubClient = createClient({ url: this.redisUrl });
//       this.subClient = this.pubClient.duplicate();

//       // connect and wait (redis v4)
//       await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
//     }

//     // attach the redis adapter to the socket.io Server instance
//     server.adapter(createAdapter(this.pubClient, this.subClient));

//     return server;
//   }

//   // optional: cleanup on shutdown
//   async close(): Promise<void> {
//     try {
//       await this.pubClient?.quit();
//       await this.subClient?.quit();
//     } catch (err) {
//       // ignore
//     }
//   }
// }



// src/adapters/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;

  constructor(private app: INestApplication, private redisUrl = 'redis://localhost:6379') {
    super(app);
  }

  // return synchronously (no `async`) — Nest expects a Server (not a Promise)
  createIOServer(port: number, options?: ServerOptions): Server {
    // create socket.io server synchronously via the base class
    const server = super.createIOServer(port, options) as Server;

    // create pub/sub clients if not created yet
    if (!this.pubClient || !this.subClient) {
      this.pubClient = createClient({ url: this.redisUrl });
      this.subClient = this.pubClient.duplicate();

      // start connecting but do not await — keeps this method synchronous
      // optional: handle connection errors so they don't crash the process
      this.pubClient.connect().catch((err) => {
        console.error('Redis pubClient connect error:', err);
      });
      this.subClient.connect().catch((err) => {
        console.error('Redis subClient connect error:', err);
      });
    }

    // attach redis adapter to the socket.io server instance
    server.adapter(createAdapter(this.pubClient, this.subClient));

    return server;
  }

  // optional tidy-up
  async close(): Promise<void> {
    try {
      await this.pubClient?.quit();
      await this.subClient?.quit();
    } catch (err) {
      // ignore
    }
  }
}
