import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    if (!(await this.healthService.isDatabaseHealthy())) {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      service: 'campuscare-api',
      database: 'ok',
    };
  }
}
