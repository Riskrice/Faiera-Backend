import { BadRequestException } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { DiscountType, PromoCodeScope } from '../entities/promo-code.entity';
import { CreatePromoCodeDto } from '../dto/promo-code.dto';

describe('PromoCodesService', () => {
  const adminId = '11111111-1111-4111-8111-111111111111';
  const startsAt = '2026-01-01T00:00:00.000Z';

  const createRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  });

  const createService = () => {
    const promoCodeRepository = createRepository();
    const redemptionRepository = createRepository();
    const dataSource = { transaction: jest.fn() };

    return {
      service: new PromoCodesService(
        promoCodeRepository as any,
        redemptionRepository as any,
        dataSource as any,
      ),
      promoCodeRepository,
    };
  };

  const baseDto = (): CreatePromoCodeDto => ({
    code: ' spring-25 ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 25,
    scope: PromoCodeScope.GLOBAL,
    startsAt,
  });

  it('normalizes and saves valid promo codes', async () => {
    const { service, promoCodeRepository } = createService();
    promoCodeRepository.findOne.mockResolvedValue(null);

    const result = await service.create(baseDto(), adminId);

    expect(result).toMatchObject({
      code: 'SPRING-25',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 25,
      maxUsesPerUser: 1,
      createdBy: adminId,
    });
    expect(result.startsAt).toBeInstanceOf(Date);
    expect(promoCodeRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects percentage discounts above 100 percent', async () => {
    const { service, promoCodeRepository } = createService();

    await expect(
      service.create({ ...baseDto(), discountValue: 101 }, adminId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(promoCodeRepository.save).not.toHaveBeenCalled();
  });

  it('rejects global promo codes with a scope reference', async () => {
    const { service, promoCodeRepository } = createService();

    await expect(
      service.create(
        {
          ...baseDto(),
          scopeReferenceId: '22222222-2222-4222-8222-222222222222',
        },
        adminId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(promoCodeRepository.save).not.toHaveBeenCalled();
  });
});
