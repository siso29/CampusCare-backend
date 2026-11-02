import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { MaintenanceRequestsController } from './maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService],
})
export class MaintenanceRequestsModule {}
