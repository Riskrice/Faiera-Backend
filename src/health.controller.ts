import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
}

@Controller('health')
@Public()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  }

  @Get('ready')
  ready(): { status: string } {
    return { status: 'ready' };
  }

  @Get('live')
  live(): { status: string } {
    return { status: 'alive' };
  }
}
