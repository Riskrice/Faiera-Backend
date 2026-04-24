import { Entity, Column, Index, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Role } from '../constants/roles.constant';

export enum UserStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    DEACTIVATED = 'deactivated',
}

@Entity('users')
export class User extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    firstName!: string;

    @Column({ type: 'varchar', length: 255 })
    lastName!: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone?: string;

    @Column({ type: 'varchar', length: 255, select: false })
    password!: string;

    @Column({ name: 'googleid', type: 'varchar', length: 255, nullable: true })
    googleId?: string;

    @Column({
        type: 'enum',
        enum: Role,
        default: Role.STUDENT,
    })
    role!: Role;

    @Column({
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.PENDING,
    })
    status!: UserStatus;

    @Column({ type: 'varchar', length: 10, nullable: true })
    grade?: string;

    @Column({ type: 'varchar', length: 5, default: 'ar' })
    preferredLanguage!: string;

    @Column({ type: 'timestamptz', nullable: true })
    lastLoginAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    emailVerifiedAt?: Date;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    parentId?: string;

    @ManyToOne(() => User, (user) => user.children, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'parentId' })
    parent?: User;

    @OneToMany(() => User, (user) => user.parent)
    children?: User[];

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'varchar', length: 255, nullable: true, select: false })
    otpCode?: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    otpExpiresAt?: Date | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    passwordResetToken?: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    passwordResetExpires?: Date | null;

    // Virtual property for full name
    get fullName(): string {
        return `${this.firstName} ${this.lastName}`;
    }
}
