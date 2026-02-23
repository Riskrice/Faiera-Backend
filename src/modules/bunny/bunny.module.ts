import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoResource } from '../content/entities/video-resource.entity';
import { BunnyNetService } from './bunny.service';
import { BunnyController } from './bunny.controller';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([VideoResource]),
    ],
    controllers: [BunnyController],
    providers: [BunnyNetService],
    exports: [BunnyNetService],
})
export class BunnyModule { }
