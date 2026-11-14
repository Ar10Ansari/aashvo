import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  CreateSavedItemDto,
  GetSavedItemsQueryDto,
  SavedItemResponseDto,
} from './dto/saved.dto';

@Injectable()
export class SavedService {
  constructor(private readonly prisma: PrismaService) {}

  async saveItem(userId: string, dto: CreateSavedItemDto): Promise<SavedItemResponseDto> {
    // 1. Prevent saving one's own profile or property
    if (dto.targetId === userId) {
      throw new BadRequestException('You cannot save your own profile to shortlists.');
    }

    // 2. Block verification
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: dto.targetId },
          { blockerId: dto.targetId, blockedId: userId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('Cannot shortlist a profile with an active user block.');
    }

    // 3. Verify target entity exists
    if (dto.itemType === 'property' || dto.itemType === 'family_stay') {
      const prop = await this.prisma.property.findUnique({
        where: { id: dto.targetId },
      });
      if (!prop) {
        throw new NotFoundException('Target property listing not found.');
      }
      if (prop.ownerId === userId) {
        throw new BadRequestException('You cannot save your own property listing to shortlists.');
      }
    } else if (dto.itemType === 'flatmate_profile' || dto.itemType === 'connect_profile') {
      const flatmate = await this.prisma.flatmateProfile.findFirst({
        where: {
          OR: [{ id: dto.targetId }, { userId: dto.targetId }],
        },
      });
      if (!flatmate) {
        throw new NotFoundException('Target flatmate profile not found.');
      }
      if (flatmate.userId === userId) {
        throw new BadRequestException('You cannot save your own flatmate profile to shortlists.');
      }
    }

    // 4. Upsert saved item (idempotent)
    const saved = await this.prisma.savedItem.upsert({
      where: {
        userId_itemType_targetId: {
          userId,
          itemType: dto.itemType,
          targetId: dto.targetId,
        },
      },
      update: {
        notes: dto.notes,
      },
      create: {
        userId,
        itemType: dto.itemType,
        targetId: dto.targetId,
        notes: dto.notes,
      },
    });

    // 5. Populate and return
    const [decorated] = await this.decorateSavedItems([saved]);
    return decorated;
  }

  async getSavedItems(
    userId: string,
    query?: GetSavedItemsQueryDto,
  ): Promise<SavedItemResponseDto[]> {
    const items = await this.prisma.savedItem.findMany({
      where: {
        userId,
        ...(query?.itemType ? { itemType: query.itemType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.decorateSavedItems(items);
  }

  async deleteSavedItem(userId: string, savedItemId: string): Promise<{ success: boolean; message: string }> {
    const item = await this.prisma.savedItem.findUnique({
      where: { id: savedItemId },
    });

    if (!item) {
      throw new NotFoundException('Saved item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You are not authorized to delete this saved item.');
    }

    await this.prisma.savedItem.delete({
      where: { id: savedItemId },
    });

    return { success: true, message: 'Item removed from shortlist.' };
  }

  async checkSaved(
    userId: string,
    itemType: string,
    targetId: string,
  ): Promise<{ isSaved: boolean; savedId?: string }> {
    const item = await this.prisma.savedItem.findFirst({
      where: {
        userId,
        itemType: itemType as any,
        targetId,
      },
    });

    return {
      isSaved: Boolean(item),
      savedId: item?.id,
    };
  }

  private async decorateSavedItems(items: any[]): Promise<SavedItemResponseDto[]> {
    if (items.length === 0) return [];

    const propertyIds = items
      .filter((i) => i.itemType === 'property' || i.itemType === 'family_stay')
      .map((i) => i.targetId);

    const flatmateTargetIds = items
      .filter((i) => i.itemType === 'flatmate_profile' || i.itemType === 'connect_profile')
      .map((i) => i.targetId);

    // Batch query properties
    const properties = propertyIds.length > 0
      ? await this.prisma.property.findMany({
          where: { id: { in: propertyIds } },
          include: { photos: { where: { isPrimary: true }, take: 1 } },
        })
      : [];

    const propMap = new Map(properties.map((p) => [p.id, p]));

    // Batch query flatmates
    const flatmates = flatmateTargetIds.length > 0
      ? await this.prisma.flatmateProfile.findMany({
          where: {
            OR: [
              { id: { in: flatmateTargetIds } },
              { userId: { in: flatmateTargetIds } },
            ],
          },
          include: { profile: true },
        })
      : [];

    const flatmateMap = new Map();
    for (const fm of flatmates) {
      flatmateMap.set(fm.id, fm);
      flatmateMap.set(fm.userId, fm);
    }

    return items.map((item) => {
      if (item.itemType === 'property' || item.itemType === 'family_stay') {
        const prop = propMap.get(item.targetId);
        if (!prop) {
          return {
            id: item.id,
            userId: item.userId,
            itemType: item.itemType,
            targetId: item.targetId,
            notes: item.notes,
            isAvailable: false,
            availabilityStatus: 'removed',
            title: 'Listing no longer available',
            subtitle: null,
            city: 'Unknown',
            locality: null,
            priceMonthly: null,
            thumbnailUrl: null,
            savedAt: item.createdAt.toISOString(),
          };
        }

        const isAvailable = prop.status === 'active';
        return {
          id: item.id,
          userId: item.userId,
          itemType: item.itemType,
          targetId: item.targetId,
          notes: item.notes,
          isAvailable,
          availabilityStatus: prop.status,
          title: prop.title,
          subtitle: `${prop.bedrooms} BHK ${prop.propertyType.replace('_', ' ')}`,
          city: prop.city,
          locality: prop.locality,
          priceMonthly: Number(prop.rentAmount),
          thumbnailUrl: prop.photos[0]?.photoUrl ?? null,
          savedAt: item.createdAt.toISOString(),
        };
      }

      // Flatmate / Connect profile
      const fm = flatmateMap.get(item.targetId);
      if (!fm) {
        return {
          id: item.id,
          userId: item.userId,
          itemType: item.itemType,
          targetId: item.targetId,
          notes: item.notes,
          isAvailable: false,
          availabilityStatus: 'removed',
          title: 'Flatmate profile no longer available',
          subtitle: null,
          city: 'Unknown',
          locality: null,
          priceMonthly: null,
          thumbnailUrl: null,
          savedAt: item.createdAt.toISOString(),
        };
      }

      const isAvailable = !fm.discoveryHidden;
      return {
        id: item.id,
        userId: item.userId,
        itemType: item.itemType,
        targetId: item.targetId,
        notes: item.notes,
        isAvailable,
        availabilityStatus: isAvailable ? 'active' : 'hidden',
        title: fm.profile.fullName,
        subtitle: fm.occupation,
        city: 'Gurugram',
        locality: fm.targetLocalities[0] ?? null,
        priceMonthly: Number(fm.budgetMax),
        thumbnailUrl: fm.profile.avatarUrl,
        savedAt: item.createdAt.toISOString(),
      };
    });
  }
}
