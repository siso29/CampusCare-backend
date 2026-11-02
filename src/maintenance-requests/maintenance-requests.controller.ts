import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('images/:filename')
  @Roles(UserRole.STUDENT, UserRole.MAINTENANCE_STAFF, UserRole.ADMIN)
  async getImage(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
  ) {
    const image = await this.service.getImage(filename, user);
    return new StreamableFile(image.buffer, {
      type: image.mimetype,
      disposition: 'inline',
    });
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
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
    }),
  )
  create(
    @Body() dto: CreateMaintenanceRequestDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile()
    image?: { buffer: Buffer; mimetype: string },
  ) {
    if (image && !this.service.isSupportedImage(image)) {
      throw new BadRequestException(
        'Image must be a valid JPG, PNG, or WebP file.',
      );
    }
    return this.service.create(dto, user, image);
  }
}
