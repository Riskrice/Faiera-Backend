import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    userId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 500, unique: true })
    token!: string;

    @Column({ type: 'timestamptz' })
    expiresAt!: Date;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent?: string;

    @Column({ type: 'boolean', default: false })
    isRevoked!: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    revokedAt?: Date;

    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    isValid(): boolean {
        return !this.isRevoked && !this.isExpired();
    }
}
