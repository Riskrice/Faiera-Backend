import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { ParentsController } from './controllers/parents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController, ParentsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
