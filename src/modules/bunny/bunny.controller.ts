import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { BunnyNetService } from './bunny.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('bunny')
export class BunnyController {
  private readonly logger = new Logger(BunnyController.name);

  constructor(private readonly bunnyService: BunnyNetService) {}

  @Public() // Webhooks come from external service
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any, @Headers('signature') signature: string) {
    // Verify signature
    if (!this.bunnyService.verifyWebhookSignature(payload, signature || '')) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(`Received Bunny webhook: ${JSON.stringify(payload)}`);

    // Process event
    await this.bunnyService.processWebhookEvent(payload);

    return { received: true };
  }
}
