import { IsEnum } from 'class-validator';
import { RequestStatus } from '../../generated/prisma/enums';

export class UpdateMaintenanceRequestStatusDto {
  @IsEnum(RequestStatus)
  status!: RequestStatus;
}
