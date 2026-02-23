import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthService } from './supabase-auth.service';

import { SUPABASE_CLIENT } from './supabase.constants';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: SUPABASE_CLIENT,
            useFactory: (configService: ConfigService): SupabaseClient | null => {
                const url = configService.get<string>('supabase.url');
                const serviceKey = configService.get<string>('supabase.serviceKey');

                if (!url || !serviceKey) {
                    new Logger('SupabaseModule').warn('Supabase credentials not configured. Supabase Auth disabled.');
                    return null;
                }

                return createClient(url, serviceKey, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                    },
                });
            },
            inject: [ConfigService],
        },
        SupabaseAuthService,
    ],
    exports: [SUPABASE_CLIENT, SupabaseAuthService],
})
export class SupabaseModule { }
