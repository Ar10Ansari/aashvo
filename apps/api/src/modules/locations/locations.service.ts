import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SUPPORTED_INDIAN_CITIES, VERIFIED_INDIAN_LANDMARKS } from './data/locations.data';
import type {
  CityResponseDto,
  GetLandmarksQueryDto,
  LandmarkResponseDto,
  LocalityResponseDto,
  LocationsResponseDto,
} from './dto/locations.dto';

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCities(withInventoryOnly = false): Promise<LocationsResponseDto> {
    const counts = await this.prisma.property.groupBy({
      by: ['city'],
      where: { status: 'active' },
      _count: { id: true },
    });

    const cityCountMap = new Map<string, number>();
    for (const item of counts) {
      cityCountMap.set(item.city.toLowerCase(), item._count.id);
    }

    const cities: CityResponseDto[] = [];

    for (const def of SUPPORTED_INDIAN_CITIES) {
      // Check city inventory by exact name or common aliases
      const count =
        cityCountMap.get(def.name.toLowerCase()) ??
        cityCountMap.get(def.id.toLowerCase()) ??
        0;

      if (withInventoryOnly && count === 0) {
        continue;
      }

      cities.push({
        id: def.id,
        name: def.name,
        state: def.state,
        latitude: def.latitude,
        longitude: def.longitude,
        activeListingCount: count,
        popularLocalities: def.popularLocalities.map((loc) => ({
          name: loc.name,
          pincode: loc.pincode,
          metroLine: loc.metroLine,
          landmarks: loc.landmarks,
        })),
      });
    }

    return {
      cities,
      totalCities: cities.length,
    };
  }

  async getLocalities(
    cityName: string,
    search?: string,
    withInventoryOnly = false,
    pincode?: string,
  ): Promise<LocalityResponseDto[]> {
    const cityLower = cityName.toLowerCase();
    const cityDef = SUPPORTED_INDIAN_CITIES.find(
      (c) => c.name.toLowerCase() === cityLower || c.id.toLowerCase() === cityLower,
    );

    // Query active counts by locality in this city from database
    const dbLocalityCounts = await this.prisma.property.groupBy({
      by: ['locality'],
      where: {
        city: { equals: cityName, mode: 'insensitive' },
        status: 'active',
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const item of dbLocalityCounts) {
      countMap.set(item.locality.toLowerCase(), item._count.id);
    }

    const results: LocalityResponseDto[] = [];
    const knownLocalityNames = new Set<string>();

    if (cityDef) {
      for (const loc of cityDef.popularLocalities) {
        const count = countMap.get(loc.name.toLowerCase()) ?? 0;
        if (withInventoryOnly && count === 0) {
          continue;
        }

        if (search && !loc.name.toLowerCase().includes(search.toLowerCase())) {
          continue;
        }

        if (pincode && loc.pincode && !loc.pincode.startsWith(pincode)) {
          continue;
        }

        knownLocalityNames.add(loc.name.toLowerCase());
        results.push({
          name: loc.name,
          pincode: loc.pincode,
          metroLine: loc.metroLine,
          landmarks: loc.landmarks,
          activeListingCount: count,
        });
      }
    }

    // Include any additional localities present in active listings not in static popular list
    for (const dbLoc of dbLocalityCounts) {
      if (!knownLocalityNames.has(dbLoc.locality.toLowerCase())) {
        if (search && !dbLoc.locality.toLowerCase().includes(search.toLowerCase())) {
          continue;
        }
        results.push({
          name: dbLoc.locality,
          activeListingCount: dbLoc._count.id,
        });
      }
    }

    return results;
  }

  async getLandmarks(query: GetLandmarksQueryDto): Promise<LandmarkResponseDto[]> {
    let list = [...VERIFIED_INDIAN_LANDMARKS];

    if (query.city) {
      const qCity = query.city.toLowerCase();
      list = list.filter(
        (lm) =>
          lm.city.toLowerCase() === qCity ||
          lm.city.toLowerCase().includes(qCity) ||
          qCity.includes(lm.city.toLowerCase()),
      );
    }

    if (query.category) {
      list = list.filter((lm) => lm.category === query.category);
    }

    if (query.search) {
      const s = query.search.toLowerCase();
      list = list.filter(
        (lm) =>
          lm.name.toLowerCase().includes(s) ||
          lm.locality.toLowerCase().includes(s) ||
          (lm.nearestMetro && lm.nearestMetro.toLowerCase().includes(s)),
      );
    }

    return list.map((lm) => {
      let distanceKm: number | undefined;
      if (query.latitude !== undefined && query.longitude !== undefined) {
        distanceKm = calculateHaversineDistanceKm(
          query.latitude,
          query.longitude,
          lm.latitude,
          lm.longitude,
        );
      }

      return {
        id: lm.id,
        name: lm.name,
        category: lm.category,
        city: lm.city,
        locality: lm.locality,
        latitude: lm.latitude,
        longitude: lm.longitude,
        nearestMetro: lm.nearestMetro,
        distanceKm,
      };
    });
  }
}

