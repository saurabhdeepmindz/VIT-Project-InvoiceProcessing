/**
 * @file   auth.module.ts
 * @module Auth
 * @since 1.0.0
 */

import { Module }        from '@nestjs/common';
import { JwtModule }     from '@nestjs/jwt';
import { PassportModule }from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { UserEntity }       from './entities/user.entity';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { JwtStrategy }      from './strategies/jwt.strategy';
import { RefreshStrategy }  from './strategies/refresh.strategy';
import { AppLogger }        from '../common/logger/AppLogger';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy, AppLogger],
  exports: [AuthService],
})
export class AuthModule {}
