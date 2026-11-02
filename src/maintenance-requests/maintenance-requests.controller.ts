import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Controller('maintenance-requests')
export class MaintenanceRequestsController {
  constructor(private readonly service: MaintenanceRequestsService) {}

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @Get()
  findAll(@Query() query: ListMaintenanceRequestsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMaintenanceRequestDto) {
    return this.service.create(dto);
  }
}
