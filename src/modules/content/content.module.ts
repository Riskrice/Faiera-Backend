import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Program } from './entities/program.entity';
import { Course } from './entities/course.entity';
import { Module as ContentModule } from './entities/module.entity';
import { Lesson } from './entities/lesson.entity';
import { VideoResource } from './entities/video-resource.entity';
import { Enrollment } from './entities/enrollment.entity';
import { ContentService } from './services/content.service';
import { ContentController } from './controllers/content.controller';
import { BunnyModule } from '../bunny/bunny.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Program, Course, ContentModule, Lesson, VideoResource, Enrollment]),
        BunnyModule,
    ],
    controllers: [ContentController],
    providers: [ContentService],
    exports: [ContentService],
})
export class ContentManagementModule { }
