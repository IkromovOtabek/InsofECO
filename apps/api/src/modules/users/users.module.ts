import { Module } from '@nestjs/common';
import { AvatarsController, UsersController } from './users.controller';

@Module({ controllers: [UsersController, AvatarsController] })
export class UsersModule {}
