import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { TeacherProfile } from './teacher-profile.entity';
import { TeacherBooking } from './teacher-booking.entity';

@Entity('teacher_reviews')
export class TeacherReview extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    teacherId!: string;

    @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teacherId' })
    teacher!: TeacherProfile;

    @Index()
    @Column({ type: 'uuid' })
    studentId!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    studentName?: string;

    @Column({ type: 'uuid', nullable: true })
    bookingId?: string;

    @ManyToOne(() => TeacherBooking, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'bookingId' })
    booking?: TeacherBooking;

    @Column({ type: 'int' })
    rating!: number;

    @Column({ type: 'int', nullable: true })
    teachingQuality?: number;

    @Column({ type: 'int', nullable: true })
    communication?: number;

    @Column({ type: 'int', nullable: true })
    punctuality?: number;

    @Column({ type: 'int', nullable: true })
    subjectKnowledge?: number;

    @Column({ type: 'text', nullable: true })
    comment?: string;

    @Column({ type: 'boolean', default: true })
    isPublic!: boolean;

    @Column({ type: 'boolean', default: false })
    isVerified!: boolean;

    // Teacher response
    @Column({ type: 'text', nullable: true })
    teacherResponse?: string;

    @Column({ type: 'timestamptz', nullable: true })
    respondedAt?: Date;
}
