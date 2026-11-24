import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { parseId } from '../common/parse-id.js';
import { validate } from '../common/zod-validation.pipe.js';
import { PropertiesService } from './properties.service.js';
import { publicListQuerySchema } from './property.schemas.js';

/**
 * Unauthenticated read access to published listings. This is the contract the
 * public website will consume once it is migrated onto the shared API.
 *
 * Sold and rented listings are excluded from the list but remain reachable by
 * id so their detail pages can still render with a Sold/Rented label.
 */
@Controller('public/properties')
export class PublicPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Query(validate(publicListQuerySchema)) query: z.infer<typeof publicListQuerySchema>) {
    return this.properties.listPublic(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.properties.findOnePublic(parseId(id));
  }
}
