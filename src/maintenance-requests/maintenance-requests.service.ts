import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.interface';
import { Prisma } from '../generated/prisma/client';
import {
  RequestStatus,
  RequestPriority,
} from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';

function buildOrderBy(
  query: ListMaintenanceRequestsDto,
): Prisma.MaintenanceRequestOrderByWithRelationInput {
  const direction = query.sortOrder ?? 'desc';

  switch (query.sortBy ?? 'createdAt') {
    case 'title':
      return { title: direction };
    case 'priority':
      return { priority: direction };
    case 'status':
      return { status: direction };
    default:
      return { createdAt: direction };
  }
}

function canManageAllRequests(user: AuthUser): boolean {
  return user.role === 'ADMIN' || user.role === 'MAINTENANCE_STAFF';
}

@Injectable()
export class MaintenanceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [total, pending, inProgress, resolved, highPriority] =
      await Promise.all([
        this.prisma.maintenanceRequest.count(),
        this.prisma.maintenanceRequest.count({
          where: { status: RequestStatus.PENDING },
        }),
        this.prisma.maintenanceRequest.count({
          where: { status: RequestStatus.IN_PROGRESS },
        }),
        this.prisma.maintenanceRequest.count({
          where: { status: RequestStatus.RESOLVED },
        }),
        this.prisma.maintenanceRequest.count({
          where: { priority: RequestPriority.HIGH },
        }),
      ]);

    return { total, pending, inProgress, resolved, highPriority };
  }

  async findAll(query: ListMaintenanceRequestsDto, user: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(!canManageAllRequests(user) ? { reporterId: user.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority
        ? { priority: query.priority as RequestPriority }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        orderBy: buildOrderBy(query),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }
    if (!canManageAllRequests(user) && request.reporterId !== user.id) {
      throw new ForbiddenException('You do not have access to this request');
    }

    return request;
  }

  create(dto: CreateMaintenanceRequestDto, user: AuthUser) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can submit maintenance requests');
    }
    return this.prisma.maintenanceRequest.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        location: dto.location,
        priority: dto.priority ?? RequestPriority.MEDIUM,
        reporterId: user.id,
      },
    });
  }
}
