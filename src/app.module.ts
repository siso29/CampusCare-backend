import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MaintenanceRequestsModule } from './maintenance-requests/maintenance-requests.module';

@Module({
  imports: [HealthModule, MaintenanceRequestsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
