import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  RequestCategory,
  RequestPriority,
} from '../../generated/prisma/enums';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateMaintenanceRequestDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsEnum(RequestCategory)
  category!: RequestCategory;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  location!: string;

  @IsOptional()
  @IsEnum(RequestPriority)
  priority?: RequestPriority;
}
