import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Course } from './course.entity';
import { Lesson } from './lesson.entity';

@Entity('modules')
export class Module extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  titleAr!: string;

  @Column({ type: 'varchar', length: 255 })
  titleEn!: string;

  @Column({ type: 'text', nullable: true })
  descriptionAr?: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn?: string;

  @Index()
  @Column({ type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => Course, course => course.modules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course!: Course;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => Lesson, lesson => lesson.module)
  lessons!: Lesson[];
}
