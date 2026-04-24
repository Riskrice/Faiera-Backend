import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('admin_audit_logs')
@Index('IDX_admin_audit_actorId_createdAt', ['actorId', 'createdAt'])
@Index('IDX_admin_audit_targetUserId', ['targetUserId'])
@Index('IDX_admin_audit_action_resource', ['action', 'resource'])
export class AdminAuditLog extends BaseEntity {
  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'uuid', nullable: true })
  targetUserId?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100 })
  resource!: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorId' })
  actor!: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser?: User;
}
