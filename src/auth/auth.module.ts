import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from 'src/users/users.service';
import { DatabaseService } from 'src/database/database.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { WalletModule } from 'src/wallet/wallet.module'; 

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    
    JwtModule.registerAsync({
      imports: [ConfigModule, UsersModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '0' }, // Setting expiresIn to '0' to never expire
      }),
    }),
    WalletModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    DatabaseService,
    LocalStrategy,
    JwtStrategy,
  ],
   exports: [JwtModule, AuthService],
})
export class AuthModule {}
