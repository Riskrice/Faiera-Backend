import { Entity, Column, ManyToMany, JoinTable, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Permission } from './permission.entity';

@Entity('admin_roles')
@Index('UQ_admin_roles_name', ['name'], { unique: true })
export class AdminRole extends BaseEntity {
    @Column({ type: 'varchar', length: 100, unique: true })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'boolean', default: false })
    isSystem!: boolean;

    @ManyToMany(() => Permission, { cascade: false })
    @JoinTable({
        name: 'admin_role_permissions',
        joinColumn: { name: 'roleId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
    })
    permissions!: Permission[];
}
