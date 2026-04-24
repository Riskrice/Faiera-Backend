import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../auth/entities/user.entity';
import { AdminRole } from './admin-role.entity';
import { Role } from '../../auth/constants/roles.constant';

@Entity('admin_users')
@Index('UQ_admin_users_userId', ['userId'], { unique: true })
@Index('IDX_admin_users_roleId', ['roleId'])
export class AdminUser extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;

  @Column({ type: 'uuid', nullable: true })
  assignedById?: string;

  @Column({ type: 'enum', enum: Role, nullable: true })
  previousRole?: Role;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  revokedById?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => AdminRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role!: AdminRole;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedById' })
  assignedBy?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'revokedById' })
  revokedBy?: User;
}
