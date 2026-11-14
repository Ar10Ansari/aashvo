import {
  ERROR_CODES,
  type FurnishingStatus,
  type GenderPreference,
  type MealsOffered as ContractMealsOffered,
  type ModerationStatus as ContractModerationStatus,
  type PropertyType,
  type ProviderType,
  type RoomType,
} from '@aashvo/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MealsOffered as PrismaMealsOffered, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  FamilyStayDetailDto,
  FamilyStayListItemDto,
  PaginatedFamilyStaysResponseDto,
  SearchFamilyStaysQueryDto,
} from './dto/family-stays.dto';

@Injectable()
export class FamilyStaysService {
  constructor(private readonly prisma: PrismaService) {}

  async searchFamilyStays(query: SearchFamilyStaysQueryDto): Promise<PaginatedFamilyStaysResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      status: 'active',
      category: 'family_stays',
      familyLivesOnProperty: true, // Strict validation: must be genuine family stay
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.locality ? { locality: { contains: query.locality, mode: 'insensitive' } } : {}),
      ...(query.mealsOffered ? { mealsOffered: query.mealsOffered as PrismaMealsOffered } : {}),
      ...(query.minRent !== undefined || query.maxRent !== undefined
        ? {
            rentAmount: {
              ...(query.minRent !== undefined ? { gte: new Prisma.Decimal(query.minRent) } : {}),
              ...(query.maxRent !== undefined ? { lte: new Prisma.Decimal(query.maxRent) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { photos: true },
      }),
    ]);

    const data: FamilyStayListItemDto[] = items.map((item) => {
      const primary = item.photos?.find((p) => p.isPrimary) ?? item.photos?.[0];
      return {
        id: item.id,
        ownerId: item.ownerId,
        title: item.title,
        category: 'family_stays',
        propertyType: item.propertyType as PropertyType,
        roomType: item.roomType as RoomType,
        furnishing: item.furnishing as FurnishingStatus,
        locality: item.locality,
        city: item.city,
        state: item.state,
        pincode: item.pincode,
        rentAmount: Number(item.rentAmount),
        depositAmount: Number(item.depositAmount),
        maintenanceCharge: Number(item.maintenanceCharge),
        providerType: item.providerType as ProviderType,
        genderPreference: item.genderPreference as GenderPreference,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        availableFrom: item.availableFrom,
        amenities: item.amenities,
        familyLivesOnProperty: true,
        verifiedHostFamily: true,
        mealsOffered: item.mealsOffered as ContractMealsOffered,
        optionalMealCost: item.optionalMealCost ? Number(item.optionalMealCost) : null,
        featured: item.featured,
        status: item.status as ContractModerationStatus,
        primaryPhotoUrl: primary?.photoUrl ?? null,
        photosCount: item.photos?.length ?? 0,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
      },
    };
  }

  async getFamilyStayById(id: string): Promise<FamilyStayDetailDto> {
    const item = await this.prisma.property.findUnique({
      where: { id },
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

    if (!item || item.category !== 'family_stays' || !item.familyLivesOnProperty || item.status !== 'active') {
      throw new NotFoundException({
        code: ERROR_CODES.PROPERTY_NOT_FOUND,
        message: 'Family stay property not found or is no longer active.',
      });
    }

    const primary = item.photos?.find((p) => p.isPrimary) ?? item.photos?.[0];
    return {
      id: item.id,
      ownerId: item.ownerId,
      title: item.title,
      description: item.description,
      category: 'family_stays',
      propertyType: item.propertyType as PropertyType,
      roomType: item.roomType as RoomType,
      furnishing: item.furnishing as FurnishingStatus,
      locality: item.locality,
      city: item.city,
      state: item.state,
      pincode: item.pincode,
      addressShort: item.addressShort,
      rentAmount: Number(item.rentAmount),
      depositAmount: Number(item.depositAmount),
      maintenanceCharge: Number(item.maintenanceCharge),
      electricityRatePerUnit: item.electricityRatePerUnit ? Number(item.electricityRatePerUnit) : null,
      brokerageFee: Number(item.brokerageFee),
      providerType: item.providerType as ProviderType,
      genderPreference: item.genderPreference as GenderPreference,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      availableFrom: item.availableFrom,
      amenities: item.amenities,
      houseRules: item.houseRules,
      familyLivesOnProperty: true,
      verifiedHostFamily: true,
      mealsOffered: item.mealsOffered as ContractMealsOffered,
      optionalMealCost: item.optionalMealCost ? Number(item.optionalMealCost) : null,
      featured: item.featured,
      status: item.status as ContractModerationStatus,
      primaryPhotoUrl: primary?.photoUrl ?? null,
      photosCount: item.photos?.length ?? 0,
      createdAt: item.createdAt.toISOString(),
      moderationReason: item.moderationReason,
      photos: (item.photos ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          photoUrl: p.photoUrl,
          roomTag: p.roomTag,
          isPrimary: p.isPrimary,
          sortOrder: p.sortOrder,
        })),
      owner: {
        id: item.owner.id,
        fullName: item.owner.fullName,
        role: item.owner.role,
        avatarUrl: item.owner.avatarUrl,
        idVerified: item.owner.idVerified,
        phoneVerified: item.owner.phoneVerified,
      },
    };
  }
}

