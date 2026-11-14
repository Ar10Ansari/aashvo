import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'aashvo:is_public';

/** Marks a controller or route handler as publicly accessible without a bearer JWT. */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);

type CustomDecorator<TKey = string> = MethodDecorator & ClassDecorator & { KEY?: TKey };

