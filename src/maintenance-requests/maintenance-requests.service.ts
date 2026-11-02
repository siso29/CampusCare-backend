import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthUser } from '../auth/auth-user.interface';
import { Prisma } from '../generated/prisma/client';
import { RequestStatus, RequestPriority } from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { UPLOADS_DIRECTORY } from '../uploads';

const imageFormats = [
  {
    extension: '.jpg',
    mimetype: 'image/jpeg',
    matches: (buffer: Buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    extension: '.png',
    mimetype: 'image/png',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: '.webp',
    mimetype: 'image/webp',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
] as const;

function getImageFormat(image: { buffer: Buffer; mimetype: string }) {
  return imageFormats.find(
    (format) =>
      image.mimetype === format.mimetype && format.matches(image.buffer),
  );
}

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
  private readonly logger = new Logger(MaintenanceRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  isSupportedImage(image: { buffer: Buffer; mimetype: string }): boolean {
    return getImageFormat(image) !== undefined;
  }

  async getImage(filename: string, user: AuthUser) {
    if (!/^[\da-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
      throw new NotFoundException('Maintenance request image not found');
    }

    const imageUrl = `/api/maintenance-requests/images/${filename}`;
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { imageUrl },
      select: { reporterId: true },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request image not found');
    }
    if (!canManageAllRequests(user) && request.reporterId !== user.id) {
      throw new ForbiddenException('You do not have access to this image');
    }

    const format = imageFormats.find((supported) =>
      filename.endsWith(supported.extension),
    );
    if (!format) {
      throw new NotFoundException('Maintenance request image not found');
    }

    return {
      buffer: await readFile(
        join(UPLOADS_DIRECTORY, 'maintenance-requests', filename),
      ),
      mimetype: format.mimetype,
    };
  }

  async getSummary(user: AuthUser) {
    const where: Prisma.MaintenanceRequestWhereInput = canManageAllRequests(user)
      ? {}
      : { reporterId: user.id };
    const [total, pending, inProgress, resolved, highPriority] =
      await Promise.all([
        this.prisma.maintenanceRequest.count({ where }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, status: RequestStatus.PENDING },
        }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, status: RequestStatus.IN_PROGRESS },
        }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, status: RequestStatus.RESOLVED },
        }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, priority: RequestPriority.HIGH },
        }),
      ]);

    return { total, pending, inProgress, resolved, highPriority };
  }

  async updateStatus(id: string, status: RequestStatus) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.maintenanceRequest.updateMany({
        where: { id },
        data: { status },
      });
      if (result.count === 0) {
        throw new NotFoundException('Maintenance request not found');
      }

      return transaction.maintenanceRequest.findUniqueOrThrow({
        where: { id },
      });
    });
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

  async create(
    dto: CreateMaintenanceRequestDto,
    user: AuthUser,
    image?: { buffer: Buffer; mimetype: string },
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException(
        'Only students can submit maintenance requests',
      );
    }

    const format = image ? getImageFormat(image) : undefined;
    if (image && !format) {
      throw new BadRequestException(
        'Image must be a valid JPG, PNG, or WebP file.',
      );
    }

    const filename = format ? `${randomUUID()}${format.extension}` : undefined;
    const imagePath = filename
      ? join(UPLOADS_DIRECTORY, 'maintenance-requests', filename)
      : undefined;

    if (imagePath && image) {
      await mkdir(join(UPLOADS_DIRECTORY, 'maintenance-requests'), {
        recursive: true,
      });
      await writeFile(imagePath, image.buffer, { flag: 'wx' });
    }

    try {
      return await this.prisma.maintenanceRequest.create({
        data: {
          title: dto.title,
          description: dto.description,
          category: dto.category,
          location: dto.location,
          priority: dto.priority ?? RequestPriority.MEDIUM,
          reporterId: user.id,
          imageUrl: filename
            ? `/api/maintenance-requests/images/${filename}`
            : null,
        },
      });
    } catch (error) {
      if (imagePath) {
        try {
          await unlink(imagePath);
        } catch (cleanupError) {
          this.logger.error(
            `Failed to remove uploaded image ${imagePath} after request creation failed.`,
            cleanupError instanceof Error ? cleanupError.stack : undefined,
          );
        }
      }
      throw error;
    }
  }
}
