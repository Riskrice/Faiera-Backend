import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants';
import { User, UserStatus } from '../auth/entities/user.entity';
import { Role } from '../auth/constants/roles.constant';

export interface SupabaseJwtPayload {
    sub: string;           // Supabase user ID
    email?: string;
    phone?: string;
    aud: string;           // 'authenticated'
    role: string;          // 'authenticated'
    exp: number;
    iat: number;
}

import { ModuleRef } from '@nestjs/core';

@Injectable()
export class SupabaseAuthService {
    private readonly logger = new Logger(SupabaseAuthService.name);
    private userRepository!: Repository<User>;

    constructor(
        @Inject(SUPABASE_CLIENT)
        private readonly supabase: SupabaseClient | null,
        private readonly moduleRef: ModuleRef,
    ) { }

    async onModuleInit() {
        try {
            this.userRepository = this.moduleRef.get(getRepositoryToken(User), { strict: false });
        } catch (error) {
            this.logger.error('Failed to resolve UserRepository', error);
        }
    }

    /**
     * Check if Supabase is configured and available
     */
    isConfigured(): boolean {
        return this.supabase !== null;
    }

    /**
     * Validate a Supabase JWT token and return the user
     */
    async validateToken(token: string): Promise<SupabaseUser | null> {
        if (!this.supabase) {
            return null;
        }

        try {
            const { data, error } = await this.supabase.auth.getUser(token);

            if (error || !data.user) {
                this.logger.warn(`Supabase token validation failed: ${error?.message}`);
                return null;
            }

            return data.user;
        } catch (error) {
            this.logger.error(`Supabase token validation error: ${error}`);
            return null;
        }
    }

    /**
     * Sync Supabase user to local database
     * Creates a new user if not exists, or updates existing
     */
    async syncUserToLocal(supabaseUser: SupabaseUser): Promise<User> {
        const email = supabaseUser.email?.toLowerCase();

        if (!email) {
            throw new UnauthorizedException('Supabase user has no email');
        }

        // Check if user exists by Supabase ID (in metadata) or email
        let user = await this.userRepository.findOne({
            where: [
                { email },
            ],
        });

        const metadata = supabaseUser.user_metadata || {};

        if (!user) {
            // Create new user
            user = this.userRepository.create({
                email,
                firstName: metadata.full_name?.split(' ')[0] || metadata.name?.split(' ')[0] || 'User',
                lastName: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.name?.split(' ').slice(1).join(' ') || '',
                password: crypto.randomBytes(32).toString('hex'), // Random unusable password for OAuth users
                phone: supabaseUser.phone || undefined,
                role: Role.STUDENT, // Default role
                status: supabaseUser.email_confirmed_at ? UserStatus.ACTIVE : UserStatus.PENDING,
                metadata: {
                    supabaseId: supabaseUser.id,
                    provider: supabaseUser.app_metadata?.provider || 'email',
                    avatarUrl: metadata.avatar_url || metadata.picture,
                },
            });

            await this.userRepository.save(user);
            this.logger.log(`Created local user for Supabase user: ${email}`);
        } else {
            // Update existing user with Supabase info if needed
            let needsUpdate = false;

            if (!user.metadata?.supabaseId) {
                needsUpdate = true;
            }

            const shouldActivate = supabaseUser.email_confirmed_at && user.status === UserStatus.PENDING;

            if (needsUpdate || shouldActivate) {
                const newMetadata = {
                    ...user.metadata,
                    supabaseId: supabaseUser.id,
                    provider: supabaseUser.app_metadata?.provider || 'email',
                    avatarUrl: metadata.avatar_url || metadata.picture,
                };

                await this.userRepository
                    .createQueryBuilder()
                    .update(User)
                    .set({
                        metadata: newMetadata,
                        ...(shouldActivate ? { status: UserStatus.ACTIVE } : {}),
                    })
                    .where('id = :id', { id: user.id })
                    .execute();

                user.metadata = newMetadata;
                if (shouldActivate) {
                    user.status = UserStatus.ACTIVE;
                }
                this.logger.log(`Updated local user from Supabase: ${email}`);
            }
        }

        return user;
    }

    /**
     * Get local user by Supabase ID
     */
    async getUserBySupabaseId(supabaseId: string): Promise<User | null> {
        // Query using JSON path for metadata.supabaseId
        return this.userRepository
            .createQueryBuilder('user')
            .where("user.metadata->>'supabaseId' = :supabaseId", { supabaseId })
            .getOne();
    }
}
