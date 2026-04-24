import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Assessment } from './assessment.entity';
import { Question } from './question.entity';

@Entity('assessment_questions')
export class AssessmentQuestion extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  assessmentId!: string;

  @ManyToOne(() => Assessment, assessment => assessment.assessmentQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentId' })
  assessment!: Assessment;

  @Index()
  @Column({ type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question!: Question;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'int', nullable: true })
  overridePoints?: number;

  @Column({ type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ type: 'boolean', default: true })
  includeInPool!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
