import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiveSession } from './entities/live-session.entity';
import { SessionAttendee } from './entities/session-attendee.entity';
import { JitsiService } from './services/jitsi.service';
import { SessionsService } from './services/sessions.service';
import { SessionsController } from './controllers/sessions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LiveSession, SessionAttendee]),
        NotificationsModule,
    ],
    controllers: [SessionsController],
    providers: [JitsiService, SessionsService],
    exports: [SessionsService, JitsiService],
})
export class SessionsModule { }
