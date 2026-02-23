import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { TeacherProfile } from './teacher-profile.entity';

export enum DayOfWeek {
    SUNDAY = 0,
    MONDAY = 1,
    TUESDAY = 2,
    WEDNESDAY = 3,
    THURSDAY = 4,
    FRIDAY = 5,
    SATURDAY = 6,
}

@Entity('teacher_availability')
export class TeacherAvailability extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    teacherId!: string;

    @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teacherId' })
    teacher!: TeacherProfile;

    @Column({
        type: 'enum',
        enum: DayOfWeek,
    })
    dayOfWeek!: DayOfWeek;

    @Column({ type: 'time' })
    startTime!: string;

    @Column({ type: 'time' })
    endTime!: string;

    @Column({ type: 'boolean', default: true })
    isRecurring!: boolean;

    // For non-recurring (specific dates)
    @Column({ type: 'date', nullable: true })
    specificDate?: Date;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;
}
