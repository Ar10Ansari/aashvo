import {
  ERROR_CODES,
  type FurnishingStatus,
  type GenderPreference,
  type MealsOffered as ContractMealsOffered,
  type ModerationStatus as ContractModerationStatus,
  type PropertyCategory,
  type PropertyType,
  type ProviderType,
  type RoomType,
  type UserRole,
} from '@aashvo/contracts';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FurnishingStatus as PrismaFurnishingStatus,
  GenderPreference as PrismaGenderPreference,
  MealsOffered as PrismaMealsOffered,
  ModerationStatus as PrismaModerationStatus,
  Prisma,
  PropertyCategory as PrismaPropertyCategory,
  PropertyType as PrismaPropertyType,
  ProviderType as PrismaProviderType,
  RoomType as PrismaRoomType,
  type Property,
  type PropertyPhoto,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import type {
  CreatePropertyDto,
  ModeratePropertyDto,
  PaginatedPropertiesResponseDto,
  PropertyDetailDto,
  PropertyListItemDto,
  PropertyVerificationResponseDto,
  ReviewPropertyVerificationDto,
  SearchPropertiesQueryDto,
  SubmitPropertyVerificationDto,
  UpdatePropertyDto,
} from './dto/property.dto';

type PropertyWithPhotosAndOwner = Property & {
  photos: PropertyPhoto[];
  owner: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
    idVerified: boolean;
    phoneVerified: boolean;
  };
};

@Injectable()
export class PropertiesService {
  private readonly searchCache = new Map<string, { data: PaginatedPropertiesResponseDto; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  public clearSearchCache(): void {
    this.searchCache.clear();
  }

  private getSearchCacheKey(query: SearchPropertiesQueryDto): string {
    const entries = Object.entries(query)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }

  private toListItem(
    prop: Property & { photos?: Array<{ photoUrl: string; isPrimary: boolean }> },
  ): PropertyListItemDto {
    const primary = prop.photos?.find((p) => p.isPrimary) ?? prop.photos?.[0];
    return {
      id: prop.id,
      ownerId: prop.ownerId,
      title: prop.title,
      category: prop.category as PropertyCategory,
      propertyType: prop.propertyType as PropertyType,
      roomType: prop.roomType as RoomType,
      furnishing: prop.furnishing as FurnishingStatus,
      locality: prop.locality,
      city: prop.city,
      state: prop.state,
      pincode: prop.pincode,
      rentAmount: Number(prop.rentAmount),
      depositAmount: Number(prop.depositAmount),
      maintenanceCharge: Number(prop.maintenanceCharge),
      providerType: prop.providerType as ProviderType,
      genderPreference: prop.genderPreference as GenderPreference,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      availableFrom: prop.availableFrom,
      amenities: prop.amenities,
      familyLivesOnProperty: prop.familyLivesOnProperty,
      mealsOffered: prop.mealsOffered as ContractMealsOffered,
      optionalMealCost: prop.optionalMealCost ? Number(prop.optionalMealCost) : null,
      featured: prop.featured,
      status: prop.status as ContractModerationStatus,
      primaryPhotoUrl: primary?.photoUrl ?? null,
      photosCount: prop.photos?.length ?? 0,
      createdAt: prop.createdAt.toISOString(),
    };
  }

  private toDetail(prop: PropertyWithPhotosAndOwner): PropertyDetailDto {
    const base = this.toListItem(prop);
    return {
      ...base,
      description: prop.description,
      addressShort: prop.addressShort,
      electricityRatePerUnit: prop.electricityRatePerUnit ? Number(prop.electricityRatePerUnit) : null,
      brokerageFee: Number(prop.brokerageFee),
      houseRules: prop.houseRules,
      moderationReason: prop.moderationReason,
      photos: (prop.photos ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          photoUrl: p.photoUrl,
          roomTag: p.roomTag,
          isPrimary: p.isPrimary,
          sortOrder: p.sortOrder,
        })),
      owner: {
        id: prop.owner.id,
        fullName: prop.owner.fullName,
        role: prop.owner.role,
        avatarUrl: prop.owner.avatarUrl,
        idVerified: prop.owner.idVerified,
        phoneVerified: prop.owner.phoneVerified,
      },
    };
  }

  async createProperty(
    ownerId: string,
    role: UserRole,
    dto: CreatePropertyDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<PropertyDetailDto> {
    const isFamilyStay = dto.category === 'family_stays';
    if (isFamilyStay && dto.familyLivesOnProperty !== true) {
      throw new BadRequestException({
        code: ERROR_CODES.FAMILY_STAY_REQUIREMENT_VIOLATION,
        message:
          'Family Stays category requires the host family to live on the property (familyLivesOnProperty must be true). Ordinary landlord listings cannot masquerade as Family Stays.',
      });
    }

    if (dto.mealsOffered === 'optional_extra' && (dto.optionalMealCost === undefined || dto.optionalMealCost === null)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'optionalMealCost is required when mealsOffered is optional_extra.',
      });
    }

    let initialStatus: PrismaModerationStatus = PrismaModerationStatus.pending_review;
    if (dto.asDraft) {
      initialStatus = PrismaModerationStatus.paused;
    } else if (role === 'admin') {
      initialStatus = PrismaModerationStatus.active;
    }

    const created = await this.prisma.property.create({
      data: {
        ownerId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: (dto.category ?? 'flats_rooms') as PrismaPropertyCategory,
        propertyType: dto.propertyType as PrismaPropertyType,
        roomType: dto.roomType as PrismaRoomType,
        furnishing: dto.furnishing as PrismaFurnishingStatus,
        locality: dto.locality.trim(),
        city: dto.city.trim(),
        state: dto.state?.trim() ?? 'Delhi NCR',
        pincode: dto.pincode?.trim() ?? null,
        addressShort: dto.addressShort.trim(),
        rentAmount: new Prisma.Decimal(dto.rentAmount),
        depositAmount: new Prisma.Decimal(dto.depositAmount ?? 0),
        maintenanceCharge: new Prisma.Decimal(dto.maintenanceCharge ?? 0),
        electricityRatePerUnit: dto.electricityRatePerUnit !== undefined ? new Prisma.Decimal(dto.electricityRatePerUnit) : null,
        brokerageFee: new Prisma.Decimal(dto.brokerageFee ?? 0),
        providerType: dto.providerType as PrismaProviderType,
        genderPreference: (dto.genderPreference ?? 'any') as PrismaGenderPreference,
        bedrooms: dto.bedrooms ?? 1,
        bathrooms: dto.bathrooms ?? 1,
        availableFrom: dto.availableFrom.trim(),
        amenities: dto.amenities ?? [],
        houseRules: dto.houseRules ?? [],
        familyLivesOnProperty: dto.familyLivesOnProperty ?? false,
        mealsOffered: (dto.mealsOffered ?? 'none') as PrismaMealsOffered,
        optionalMealCost: dto.optionalMealCost !== undefined ? new Prisma.Decimal(dto.optionalMealCost) : null,
        status: initialStatus,
        photos: {
          create: (dto.photoUrls ?? []).map((p, idx) => ({
            photoUrl: p.photoUrl,
            roomTag: p.roomTag ?? null,
            isPrimary: p.isPrimary ?? idx === 0,
            sortOrder: p.sortOrder ?? idx,
          })),
        },
      },
      include: {
        photos: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            role: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      actorId: ownerId,
      actorRole: role,
      eventType: 'property.created',
      entityType: 'property',
      entityId: created.id,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: {
        title: created.title,
        status: created.status,
        category: created.category,
      },
    });

    this.clearSearchCache();
    return this.toDetail(created as PropertyWithPhotosAndOwner);
  }

  async updateProperty(
    propertyId: string,
    userId: string,
    role: UserRole,
    dto: UpdatePropertyDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<PropertyDetailDto> {
    const existing = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { photos: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property listing not found.',
      });
    }

    if (existing.ownerId !== userId && role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to update this listing.',
      });
    }

    // Category consistency check
    const newCategory = dto.category ?? existing.category;
    const newFamilyLives = dto.familyLivesOnProperty ?? existing.familyLivesOnProperty;
    if (newCategory === 'family_stays' && !newFamilyLives) {
      throw new BadRequestException({
        code: ERROR_CODES.FAMILY_STAY_REQUIREMENT_VIOLATION,
        message: 'Family Stays category requires familyLivesOnProperty to be true.',
      });
    }

    // Status transition authorization
    let statusToUpdate = existing.status;
    if (dto.status && dto.status !== existing.status) {
      if (role === 'admin') {
        statusToUpdate = dto.status as PrismaModerationStatus;
      } else {
        // Owner can pause or rent an active listing, or submit draft for review
        if (dto.status === 'paused' || dto.status === 'rented' || dto.status === 'pending_review') {
          statusToUpdate = dto.status as PrismaModerationStatus;
        } else {
          throw new ForbiddenException({
            code: ERROR_CODES.FORBIDDEN,
            message: 'Only administrators can activate or reject property listings.',
          });
        }
      }
    }

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category as PrismaPropertyCategory } : {}),
        ...(dto.propertyType !== undefined ? { propertyType: dto.propertyType as PrismaPropertyType } : {}),
        ...(dto.roomType !== undefined ? { roomType: dto.roomType as PrismaRoomType } : {}),
        ...(dto.furnishing !== undefined ? { furnishing: dto.furnishing as PrismaFurnishingStatus } : {}),
        ...(dto.locality !== undefined ? { locality: dto.locality.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
        ...(dto.pincode !== undefined ? { pincode: dto.pincode.trim() } : {}),
        ...(dto.addressShort !== undefined ? { addressShort: dto.addressShort.trim() } : {}),
        ...(dto.rentAmount !== undefined ? { rentAmount: new Prisma.Decimal(dto.rentAmount) } : {}),
        ...(dto.depositAmount !== undefined ? { depositAmount: new Prisma.Decimal(dto.depositAmount) } : {}),
        ...(dto.maintenanceCharge !== undefined ? { maintenanceCharge: new Prisma.Decimal(dto.maintenanceCharge) } : {}),
        ...(dto.electricityRatePerUnit !== undefined ? { electricityRatePerUnit: new Prisma.Decimal(dto.electricityRatePerUnit) } : {}),
        ...(dto.brokerageFee !== undefined ? { brokerageFee: new Prisma.Decimal(dto.brokerageFee) } : {}),
        ...(dto.providerType !== undefined ? { providerType: dto.providerType as PrismaProviderType } : {}),
        ...(dto.genderPreference !== undefined ? { genderPreference: dto.genderPreference as PrismaGenderPreference } : {}),
        ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
        ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
        ...(dto.availableFrom !== undefined ? { availableFrom: dto.availableFrom.trim() } : {}),
        ...(dto.amenities !== undefined ? { amenities: dto.amenities } : {}),
        ...(dto.houseRules !== undefined ? { houseRules: dto.houseRules } : {}),
        ...(dto.familyLivesOnProperty !== undefined ? { familyLivesOnProperty: dto.familyLivesOnProperty } : {}),
        ...(dto.mealsOffered !== undefined ? { mealsOffered: dto.mealsOffered as PrismaMealsOffered } : {}),
        ...(dto.optionalMealCost !== undefined ? { optionalMealCost: new Prisma.Decimal(dto.optionalMealCost) } : {}),
        status: statusToUpdate,
      },
      include: {
        photos: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            role: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'property.updated',
      entityType: 'property',
      entityId: propertyId,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
    });

    this.clearSearchCache();
    return this.toDetail(updated as PropertyWithPhotosAndOwner);
  }

  async deleteProperty(
    propertyId: string,
    userId: string,
    role: UserRole,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<void> {
    const existing = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property listing not found.',
      });
    }

    if (existing.ownerId !== userId && role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not authorized to delete this listing.',
      });
    }

    await this.prisma.property.delete({
      where: { id: propertyId },
    });

    await this.audit.record({
      actorId: userId,
      actorRole: role,
      eventType: 'property.deleted',
      entityType: 'property',
      entityId: propertyId,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
    });

    this.clearSearchCache();
  }

  async getPropertyById(
    propertyId: string,
    callerId?: string,
    callerRole?: string,
  ): Promise<PropertyDetailDto> {
    const prop = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        photos: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            role: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    if (!prop) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    // Inactive listings are hidden from the general public
    if (prop.status !== 'active') {
      const isOwner = callerId === prop.ownerId;
      const isAdmin = callerRole === 'admin';
      if (!isOwner && !isAdmin) {
        throw new NotFoundException({
          code: ERROR_CODES.PROPERTY_NOT_FOUND,
          message: 'Property is not currently active.',
        });
      }
    }

    return this.toDetail(prop as PropertyWithPhotosAndOwner);
  }

  async searchProperties(query: SearchPropertiesQueryDto): Promise<PaginatedPropertiesResponseDto> {
    const cacheKey = this.getSearchCacheKey(query);
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return JSON.parse(JSON.stringify(cached.data));
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      status: 'active', // strictly active only for public search
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.locality ? { locality: { contains: query.locality, mode: 'insensitive' } } : {}),
      ...(query.category ? { category: query.category as PrismaPropertyCategory } : {}),
      ...(query.propertyType ? { propertyType: query.propertyType as PrismaPropertyType } : {}),
      ...(query.roomType ? { roomType: query.roomType as PrismaRoomType } : {}),
      ...(query.furnishing ? { furnishing: query.furnishing as PrismaFurnishingStatus } : {}),
      ...(query.genderPreference ? { genderPreference: query.genderPreference as PrismaGenderPreference } : {}),
      ...(query.mealsOffered ? { mealsOffered: query.mealsOffered as PrismaMealsOffered } : {}),
      ...(query.featuredOnly ? { featured: true } : {}),
      ...(query.minRent !== undefined || query.maxRent !== undefined
        ? {
            rentAmount: {
              ...(query.minRent !== undefined ? { gte: new Prisma.Decimal(query.minRent) } : {}),
              ...(query.maxRent !== undefined ? { lte: new Prisma.Decimal(query.maxRent) } : {}),
            },
          }
        : {}),
      ...(query.amenities && query.amenities.length > 0
        ? { amenities: { hasEvery: query.amenities } }
        : {}),
    };

    let orderBy: Prisma.PropertyOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'rent_asc') {
      orderBy = { rentAmount: 'asc' };
    } else if (query.sortBy === 'rent_desc') {
      orderBy = { rentAmount: 'desc' };
    } else if (query.sortBy === 'available_soon') {
      orderBy = { lastAvailabilityCheck: 'desc' };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          photos: {
            select: {
              id: true,
              propertyId: true,
              photoUrl: true,
              roomTag: true,
              isPrimary: true,
              sortOrder: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const result: PaginatedPropertiesResponseDto = {
      data: items.map((item) => this.toListItem(item)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
      },
    };

    // Cache bounded to 100 entries with 15s TTL (instance-local bounded cache)
    if (this.searchCache.size >= 100) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) this.searchCache.delete(oldestKey);
    }
    this.searchCache.set(cacheKey, {
      data: JSON.parse(JSON.stringify(result)),
      expiresAt: Date.now() + 15000,
    });

    return result;
  }

  async getMyProperties(ownerId: string): Promise<PropertyListItemDto[]> {
    const items = await this.prisma.property.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { photos: true },
    });
    return items.map((item) => this.toListItem(item));
  }

  async moderateProperty(
    propertyId: string,
    adminId: string,
    dto: ModeratePropertyDto,
    meta?: { ipAddress?: string | null; requestId?: string | null },
  ): Promise<PropertyDetailDto> {
    const existing = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property listing not found.',
      });
    }

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        status: dto.status as PrismaModerationStatus,
        moderationReason: dto.reason ?? null,
      },
      include: {
        photos: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            role: true,
            avatarUrl: true,
            idVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      actorId: adminId,
      actorRole: 'admin',
      eventType: 'property.moderated',
      entityType: 'property',
      entityId: propertyId,
      outcome: 'success',
      ipAddress: meta?.ipAddress,
      requestId: meta?.requestId,
      metadata: { status: dto.status, reason: dto.reason },
    });

    this.clearSearchCache();
    return this.toDetail(updated as PropertyWithPhotosAndOwner);
  }

  async submitVerification(
    ownerId: string,
    propertyId: string,
    dto: SubmitPropertyVerificationDto,
  ): Promise<PropertyVerificationResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property listing not found.',
      });
    }

    if (property.ownerId !== ownerId) {
      throw new ForbiddenException('Only the property owner can submit verification documents.');
    }

    const verification = await this.prisma.propertyVerification.upsert({
      where: { propertyId },
      update: {
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
        ownerIdType: dto.ownerIdType,
        status: 'submitted',
        rejectionReason: null,
        submittedAt: new Date(),
      },
      create: {
        propertyId,
        submittedBy: ownerId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
        ownerIdType: dto.ownerIdType,
        status: 'submitted',
      },
    });

    await this.audit.record({
      actorId: ownerId,
      actorRole: 'owner',
      eventType: 'property.verification_submitted',
      entityType: 'property_verification',
      entityId: verification.id,
      outcome: 'success',
      metadata: { propertyId, documentType: dto.documentType },
    });

    return this.mapVerificationToDto(verification);
  }

  async getVerification(
    callerId: string,
    callerRole: string,
    propertyId: string,
  ): Promise<PropertyVerificationResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Property listing not found.',
      });
    }

    if (callerRole !== 'admin' && property.ownerId !== callerId) {
      throw new ForbiddenException('You are not authorized to view this property verification.');
    }

    const v = await this.prisma.propertyVerification.findUnique({
      where: { propertyId },
    });

    if (!v) {
      return {
        id: '',
        propertyId,
        submittedBy: property.ownerId,
        status: 'not_submitted',
        documentType: '',
        documentUrl: '',
        ownerIdType: '',
        reviewedBy: null,
        reviewNotes: null,
        rejectionReason: null,
        submittedAt: property.createdAt.toISOString(),
        reviewedAt: null,
        expiresAt: null,
        createdAt: property.createdAt.toISOString(),
        updatedAt: property.updatedAt.toISOString(),
      };
    }

    return this.mapVerificationToDto(v);
  }

  async reviewVerification(
    adminId: string,
    propertyId: string,
    dto: ReviewPropertyVerificationDto,
  ): Promise<PropertyVerificationResponseDto> {
    const v = await this.prisma.propertyVerification.findUnique({
      where: { propertyId },
      include: { property: true },
    });

    if (!v) {
      throw new NotFoundException('No verification submission exists for this property.');
    }

    const isApprove = dto.action === 'approve';
    const status = isApprove ? 'verified' : 'rejected';
    const expiresAt =
      isApprove && dto.expiresInDays
        ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const updated = await this.prisma.propertyVerification.update({
      where: { propertyId },
      data: {
        status,
        reviewedBy: adminId,
        reviewNotes: dto.reviewNotes,
        rejectionReason: isApprove
          ? null
          : (dto.rejectionReason ?? 'Document rejected upon review.'),
        reviewedAt: new Date(),
        expiresAt,
      },
    });

    // Notify owner
    await this.prisma.userNotification.create({
      data: {
        userId: v.submittedBy,
        category: 'property_verification',
        title: `Property Verification ${isApprove ? 'Approved' : 'Rejected'}`,
        body: isApprove
          ? `Your verification for "${v.property.title}" has been approved. The property now displays a Verified badge!`
          : `Your verification for "${v.property.title}" was rejected: ${dto.rejectionReason ?? 'Please re-upload valid documents.'}`,
        targetUrl: `/property/${propertyId}`,
        metadata: {
          propertyId,
          status,
          reviewNotes: dto.reviewNotes,
        },
      },
    });

    await this.audit.record({
      actorId: adminId,
      actorRole: 'admin',
      eventType: 'property.verification_reviewed',
      entityType: 'property_verification',
      entityId: updated.id,
      outcome: 'success',
      metadata: { propertyId, action: dto.action, status },
    });

    this.clearSearchCache();

    return this.mapVerificationToDto(updated);
  }

  private mapVerificationToDto(v: any): PropertyVerificationResponseDto {
    return {
      id: v.id,
      propertyId: v.propertyId,
      submittedBy: v.submittedBy,
      status: v.status,
      documentType: v.documentType,
      documentUrl: v.documentUrl,
      ownerIdType: v.ownerIdType,
      reviewedBy: v.reviewedBy,
      reviewNotes: v.reviewNotes,
      rejectionReason: v.rejectionReason,
      submittedAt: v.submittedAt.toISOString(),
      reviewedAt: v.reviewedAt ? v.reviewedAt.toISOString() : null,
      expiresAt: v.expiresAt ? v.expiresAt.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }
}
