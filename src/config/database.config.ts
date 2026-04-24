import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production' && (!process.env.DB_PASSWORD || !process.env.DB_USERNAME)) {
    throw new Error(
      'DB_USERNAME and DB_PASSWORD must be set in production. Cannot start with default credentials.',
    );
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'faiera',

    // TypeORM settings
    synchronize: nodeEnv === 'development',
    logging: nodeEnv === 'development',
    autoLoadEntities: true,

    // Connection pool
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),

    // SSL (for production)
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
});
