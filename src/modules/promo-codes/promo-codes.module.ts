import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from './entities/promo-code.entity';
import { PromoCodeRedemption } from './entities/promo-code-redemption.entity';
import { PromoCodesService } from './services/promo-codes.service';
import { PromoCodesController } from './controllers/promo-codes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, PromoCodeRedemption])],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
