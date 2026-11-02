import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/enums';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Controller('maintenance-requests')
export class MaintenanceRequestsController {
  constructor(private readonly service: MaintenanceRequestsService) {}

  @Get('summary')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.ADMIN)
  getSummary() {
    return this.service.getSummary();
  }

  @Get()
  findAll(
    @Query() query: ListMaintenanceRequestsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.STUDENT)
  create(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }
}
