import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

@Entity('permissions')
@Index(['action', 'resource'], { unique: true })
export class Permission extends BaseEntity {
  @Column({ type: 'varchar', length: 120, nullable: true })
  name?: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ type: 'varchar', length: 50 })
  resource!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;
}
