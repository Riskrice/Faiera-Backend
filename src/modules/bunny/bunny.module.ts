import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoResource } from '../content/entities/video-resource.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Module as ContentModule } from '../content/entities/module.entity';
import { Course } from '../content/entities/course.entity';
import { BunnyNetService } from './bunny.service';
import { BunnyController } from './bunny.controller';
import { BunnyUnifiedService } from '../../bunny/bunny-unified.service';
import { BunnyMigrationService } from '../../bunny/bunny-migration.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([VideoResource, Lesson, ContentModule, Course])],
  controllers: [BunnyController],
  providers: [BunnyNetService, BunnyUnifiedService, BunnyMigrationService],
  exports: [BunnyNetService, BunnyUnifiedService, BunnyMigrationService],
})
export class BunnyModule {}
