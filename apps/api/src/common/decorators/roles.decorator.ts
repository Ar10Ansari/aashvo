import type { UserRole } from '@aashvo/contracts';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'aashvo:roles';

/** Restricts access to one or more explicit platform roles. */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

type CustomDecorator<TKey = string> = MethodDecorator & ClassDecorator & { KEY?: TKey };

