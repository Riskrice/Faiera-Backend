import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromoCodes1780000000000 implements MigrationInterface {
  name = 'CreatePromoCodes1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_codes_discounttype_enum') THEN
          CREATE TYPE "promo_codes_discounttype_enum" AS ENUM ('percentage', 'fixed_amount');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_codes_scope_enum') THEN
          CREATE TYPE "promo_codes_scope_enum" AS ENUM ('global', 'course', 'plan');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_code_redemptions_status_enum') THEN
          CREATE TYPE "promo_code_redemptions_status_enum" AS ENUM ('reserved', 'completed', 'reversed', 'expired');
        ELSE
          ALTER TYPE "promo_code_redemptions_status_enum" ADD VALUE IF NOT EXISTS 'reserved';
          ALTER TYPE "promo_code_redemptions_status_enum" ADD VALUE IF NOT EXISTS 'expired';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promo_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "code" character varying(50) NOT NULL,
        "discountType" "promo_codes_discounttype_enum" NOT NULL,
        "discountValue" numeric(10,2) NOT NULL,
        "maxDiscountCap" numeric(10,2),
        "minOrderAmount" numeric(10,2),
        "scope" "promo_codes_scope_enum" NOT NULL DEFAULT 'global',
        "scopeReferenceId" uuid,
        "maxTotalUses" integer,
        "maxUsesPerUser" integer NOT NULL DEFAULT 1,
        "currentUses" integer NOT NULL DEFAULT 0,
        "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" uuid NOT NULL,
        "campaignTag" character varying(100),
        "descriptionInternal" text,
        "deactivatedAt" TIMESTAMP WITH TIME ZONE,
        "deactivatedBy" uuid,
        "metadata" jsonb,
        CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promo_code_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "promoCodeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "transactionId" uuid,
        "courseId" uuid,
        "planId" uuid,
        "originalAmount" numeric(10,2) NOT NULL,
        "discountAmount" numeric(10,2) NOT NULL,
        "finalAmount" numeric(10,2) NOT NULL,
        "reservedAt" TIMESTAMP WITH TIME ZONE,
        "reservationExpiresAt" TIMESTAMP WITH TIME ZONE,
        "redeemedAt" TIMESTAMP WITH TIME ZONE,
        "status" "promo_code_redemptions_status_enum" NOT NULL DEFAULT 'completed',
        "reversedAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "PK_promo_code_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promo_code_user_transaction" UNIQUE ("promoCodeId", "userId", "transactionId")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promo_codes_code_unique"
      ON "promo_codes" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_codes_scope_reference"
      ON "promo_codes" ("scope", "scopeReferenceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_codes_expiresAt"
      ON "promo_codes" ("expiresAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_code_redemptions_promoCodeId"
      ON "promo_code_redemptions" ("promoCodeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_code_redemptions_userId"
      ON "promo_code_redemptions" ("userId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promo_code_redemptions_transaction_unique"
      ON "promo_code_redemptions" ("transactionId")
      WHERE "transactionId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promo_code_redemptions_reservationExpiresAt"
      ON "promo_code_redemptions" ("reservationExpiresAt")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_codes' AND constraint_name = 'CHK_promo_codes_discount_value'
        ) THEN
          ALTER TABLE "promo_codes"
          ADD CONSTRAINT "CHK_promo_codes_discount_value"
          CHECK (
            "discountValue" > 0
            AND ("discountType" != 'percentage' OR "discountValue" <= 100)
          );
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_codes' AND constraint_name = 'CHK_promo_codes_scope_reference'
        ) THEN
          ALTER TABLE "promo_codes"
          ADD CONSTRAINT "CHK_promo_codes_scope_reference"
          CHECK (
            ("scope" = 'global' AND "scopeReferenceId" IS NULL)
            OR ("scope" != 'global' AND "scopeReferenceId" IS NOT NULL)
          );
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_codes' AND constraint_name = 'CHK_promo_codes_dates'
        ) THEN
          ALTER TABLE "promo_codes"
          ADD CONSTRAINT "CHK_promo_codes_dates"
          CHECK ("expiresAt" IS NULL OR "expiresAt" > "startsAt");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_code_redemptions' AND constraint_name = 'CHK_promo_redemptions_amounts'
        ) THEN
          ALTER TABLE "promo_code_redemptions"
          ADD CONSTRAINT "CHK_promo_redemptions_amounts"
          CHECK (
            "originalAmount" >= 0
            AND "discountAmount" >= 0
            AND "finalAmount" >= 0
            AND "discountAmount" <= "originalAmount"
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_codes' AND constraint_name = 'FK_promo_codes_createdBy_users'
        ) THEN
          ALTER TABLE "promo_codes"
          ADD CONSTRAINT "FK_promo_codes_createdBy_users"
          FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_codes' AND constraint_name = 'FK_promo_codes_deactivatedBy_users'
        ) THEN
          ALTER TABLE "promo_codes"
          ADD CONSTRAINT "FK_promo_codes_deactivatedBy_users"
          FOREIGN KEY ("deactivatedBy") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_code_redemptions' AND constraint_name = 'FK_promo_redemptions_promoCode'
        ) THEN
          ALTER TABLE "promo_code_redemptions"
          ADD CONSTRAINT "FK_promo_redemptions_promoCode"
          FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_code_redemptions' AND constraint_name = 'FK_promo_redemptions_user'
        ) THEN
          ALTER TABLE "promo_code_redemptions"
          ADD CONSTRAINT "FK_promo_redemptions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'promo_code_redemptions' AND constraint_name = 'FK_promo_redemptions_transaction'
        ) THEN
          ALTER TABLE "promo_code_redemptions"
          ADD CONSTRAINT "FK_promo_redemptions_transaction"
          FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions" DROP CONSTRAINT IF EXISTS "FK_promo_redemptions_transaction"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions" DROP CONSTRAINT IF EXISTS "FK_promo_redemptions_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions" DROP CONSTRAINT IF EXISTS "FK_promo_redemptions_promoCode"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "FK_promo_codes_deactivatedBy_users"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "FK_promo_codes_createdBy_users"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions" DROP CONSTRAINT IF EXISTS "CHK_promo_redemptions_amounts"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "CHK_promo_codes_dates"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "CHK_promo_codes_scope_reference"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "CHK_promo_codes_discount_value"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_code_redemptions_reservationExpiresAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_code_redemptions_transaction_unique"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_code_redemptions_userId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_code_redemptions_promoCodeId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_codes_expiresAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_codes_scope_reference"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promo_codes_code_unique"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "promo_code_redemptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promo_codes"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promo_code_redemptions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promo_codes_scope_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promo_codes_discounttype_enum"`);
  }
}
