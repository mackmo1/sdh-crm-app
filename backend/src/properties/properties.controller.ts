import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AccessGuard, CurrentUser, Modules } from '../auth/access.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { parseId } from '../common/parse-id.js';
import { validate } from '../common/zod-validation.pipe.js';
import { PropertiesService } from './properties.service.js';
import {
  archivePropertySchema,
  createPropertySchema,
  listPropertiesQuerySchema,
  setAvailabilitySchema,
  updatePropertySchema,
} from './property.schemas.js';

@Controller('properties')
@UseGuards(SessionGuard, AccessGuard)
@Modules('property')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Post()
  create(
    @Body(validate(createPropertySchema)) body: z.infer<typeof createPropertySchema>,
  ) {
    return this.properties.create(body);
  }

  @Get()
  list(@Query(validate(listPropertiesQuerySchema)) query: z.infer<typeof listPropertiesQuerySchema>) {
    return this.properties.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.properties.findOne(parseId(id));
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(updatePropertySchema)) body: z.infer<typeof updatePropertySchema>,
  ) {
    return this.properties.update(parseId(id), body);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.properties.publish(parseId(id));
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.properties.unpublish(parseId(id));
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @Param('id') id: string,
    @Body(validate(archivePropertySchema)) body: z.infer<typeof archivePropertySchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.properties.archive(parseId(id), user.id, body.reason);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string) {
    return this.properties.restore(parseId(id));
  }

  @Patch(':id/availability')
  @HttpCode(200)
  setAvailability(
    @Param('id') id: string,
    @Body(validate(setAvailabilitySchema)) body: z.infer<typeof setAvailabilitySchema>,
  ) {
    return this.properties.setAvailability(parseId(id), body.availabilityStatus);
  }
}
