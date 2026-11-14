import { ExecutionContext, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { AppConfigModule } from './infrastructure/config/config.module';
import type { AppConfig } from './infrastructure/config/env.schema';
import { HealthModule } from './infrastructure/health/health.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ConnectModule } from './modules/connect/connect.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { FamilyStaysModule } from './modules/family-stays/family-stays.module';
import { FlatmatesModule } from './modules/flatmates/flatmates.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MediaModule } from './modules/media/media.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SavedModule } from './modules/saved/saved.module';
import { SupportModule } from './modules/support/support.module';
import { UsersModule } from './modules/users/users.module';
import { VisitsModule } from './modules/visits/visits.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.shouldSkip(context);
  }
}

@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule,
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    LocationsModule,
    PropertiesModule,
    MediaModule,
    FlatmatesModule,
    ConnectModule,
    FamilyStaysModule,
    InquiriesModule,
    AgreementsModule,
    InspectionsModule,
    ReviewsModule,
    DisputesModule,
    SupportModule,
    SavedModule,
    VisitsModule,
    NotificationsModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => [
        {
          ttl: configService.get('THROTTLE_TTL_MS', { infer: true }),
          limit: configService.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
