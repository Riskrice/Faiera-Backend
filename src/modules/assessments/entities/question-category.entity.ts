import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Question } from './question.entity';

@Entity('question_categories')
export class QuestionCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  nameAr!: string;

  @Column({ type: 'varchar', length: 255 })
  nameEn!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => QuestionCategory, category => category.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent?: QuestionCategory;

  @OneToMany(() => QuestionCategory, category => category.parent)
  children!: QuestionCategory[];

  @OneToMany(() => Question, question => question.category)
  questions!: Question[];

  @Index()
  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;
}
