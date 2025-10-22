// // chat/guards/ws-jwt.guard.ts
// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// import { Observable } from 'rxjs';
// import * as jwt from 'jsonwebtoken';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class WsJwtGuard implements CanActivate {
//   constructor(private readonly config: ConfigService) {}

//   canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
//     const client = context.switchToWs().getClient();
//     // socket.io handshake: token might be in query or auth property
//     const token = client.handshake?.auth?.token || client.handshake?.query?.token;
//     if (!token) {
//       throw new UnauthorizedException('Missing token in websocket handshake');
//     }
//     try {
//       const secret = this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'secret';
//       const payload = jwt.verify(token, secret);
//       console.log('PAYLOAAD', payload)
//       // attach user to socket
//       client.user = payload;
//       return true;
//     } catch (err) {
//       throw new UnauthorizedException('Invalid token for websocket');
//     }
//   }
// }


import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const authHeader =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization ||
      client.handshake?.query?.token;

    if (!authHeader) throw new UnauthorizedException('Missing token');

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
        ignoreExpiration:true
      });
      client.user = payload; // Attach to socket
      return true;
    } catch (err) {
      throw new UnauthorizedException(`Invalid or expired token: ${err.message}`);
    }
  }
}
