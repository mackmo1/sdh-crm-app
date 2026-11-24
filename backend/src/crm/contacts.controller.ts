import {
  Body,
  Controller,
  Get,
  Param,
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
import {
  contactCreateSchema,
  contactListQuerySchema,
  ContactsService,
  contactUpdateSchema,
} from './contacts.service.js';

@Controller('contacts')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Query(validate(contactListQuerySchema)) query: z.infer<typeof contactListQuerySchema>) {
    return this.contacts.list(query);
  }

  @Get('options')
  options() {
    return this.contacts.options();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(parseId(id));
  }

  @Post()
  create(
    @Body(validate(contactCreateSchema)) body: z.infer<typeof contactCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contacts.create(body, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(contactUpdateSchema)) body: z.infer<typeof contactUpdateSchema>,
  ) {
    return this.contacts.update(parseId(id), body);
  }
}
