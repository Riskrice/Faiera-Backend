const { ValidationPipe } = require('@nestjs/common');
const { CreatePromoCodeDto, GeneratePromoCodesDto } = require('./dist/modules/promo-codes/dto/promo-code.dto');

async function test() {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });

    const payload = {
        count: 10,
        codeLength: 8,
        discountType: 'percentage',
        discountValue: 20,
        scope: 'global',
        startsAt: new Date().toISOString(),
        maxUsesPerUser: 1
    };

    try {
        await pipe.transform(payload, { type: 'body', metatype: GeneratePromoCodesDto });
        console.log("GeneratePromoCodesDto VALID");
    } catch (e) {
        console.log("GeneratePromoCodesDto INVALID", e.response);
    }

    const createPayload = {
        code: 'TESTCODE99',
        discountType: 'percentage',
        discountValue: 10,
        scope: 'global',
        startsAt: new Date().toISOString(),
        maxUsesPerUser: 1,
        isActive: true
    };

    try {
        await pipe.transform(createPayload, { type: 'body', metatype: CreatePromoCodeDto });
        console.log("CreatePromoCodeDto VALID");
    } catch (e) {
        console.log("CreatePromoCodeDto INVALID", e.response);
    }
}
test();
