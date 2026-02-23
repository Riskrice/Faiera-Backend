import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from './entities/video.entity';
import { VideoWatchProgress } from './entities/video-watch-progress.entity';
import { BunnyNetService } from './services/bunny-net.service';
import { VideoService } from './services/video.service';
import { VideoController } from './controllers/video.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Video, VideoWatchProgress]),
        SubscriptionsModule,
    ],
    controllers: [VideoController],
    providers: [BunnyNetService, VideoService],
    exports: [VideoService, BunnyNetService],
})
export class VideoModule { }
