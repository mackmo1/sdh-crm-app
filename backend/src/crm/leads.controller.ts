import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { LeadsService } from './leads.service.js';
import {
  assignLeadSchema,
  changeStageSchema,
  closeLeadSchema,
  interactionCreateSchema,
  leadCreateSchema,
  leadListQuerySchema,
  leadUpdateSchema,
  matchQuerySchema,
  reopenLeadSchema,
  requirementCreateSchema,
  requirementUpdateSchema,
  shortlistSchema,
} from './leads.schemas.js';

@Controller('leads')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Query(validate(leadListQuerySchema)) query: z.infer<typeof leadListQuerySchema>) {
    return this.leads.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leads.findOne(parseId(id));
  }

  @Post()
  create(
    @Body(validate(leadCreateSchema)) body: z.infer<typeof leadCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.create(body, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(leadUpdateSchema)) body: z.infer<typeof leadUpdateSchema>,
  ) {
    return this.leads.update(parseId(id), body);
  }

  @Post(':id/assign')
  @HttpCode(200)
  assign(
    @Param('id') id: string,
    @Body(validate(assignLeadSchema)) body: z.infer<typeof assignLeadSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.assign(parseId(id), body, user.id);
  }

  @Post(':id/stage')
  @HttpCode(200)
  changeStage(
    @Param('id') id: string,
    @Body(validate(changeStageSchema)) body: z.infer<typeof changeStageSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.changeStage(parseId(id), body, user.id);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @Param('id') id: string,
    @Body(validate(closeLeadSchema)) body: z.infer<typeof closeLeadSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.close(parseId(id), body, user.id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  reopen(
    @Param('id') id: string,
    @Body(validate(reopenLeadSchema)) body: z.infer<typeof reopenLeadSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.reopen(parseId(id), body, user.id);
  }

  @Get(':id/interactions')
  listInteractions(@Param('id') id: string) {
    return this.leads.listInteractions(parseId(id));
  }

  @Post(':id/interactions')
  addInteraction(
    @Param('id') id: string,
    @Body(validate(interactionCreateSchema)) body: z.infer<typeof interactionCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.addInteraction(parseId(id), body, user.id);
  }

  @Post(':id/requirements')
  addRequirement(
    @Param('id') id: string,
    @Body(validate(requirementCreateSchema)) body: z.infer<typeof requirementCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.addRequirement(parseId(id), body, user.id);
  }

  @Put(':id/requirements/:requirementId')
  updateRequirement(
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body(validate(requirementUpdateSchema)) body: z.infer<typeof requirementUpdateSchema>,
  ) {
    return this.leads.updateRequirement(parseId(id), parseId(requirementId), body);
  }

  @Delete(':id/requirements/:requirementId')
  @HttpCode(204)
  async deleteRequirement(
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
  ): Promise<void> {
    await this.leads.deleteRequirement(parseId(id), parseId(requirementId));
  }

  @Get(':id/requirements/:requirementId/matches')
  matches(
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Query(validate(matchQuerySchema)) query: z.infer<typeof matchQuerySchema>,
  ) {
    return this.leads.matchRequirement(parseId(id), parseId(requirementId), query);
  }

  @Get(':id/requirements/:requirementId/shortlist')
  shortlisted(@Param('id') id: string, @Param('requirementId') requirementId: string) {
    return this.leads.shortlistedProperties(parseId(id), parseId(requirementId));
  }

  @Post(':id/requirements/:requirementId/shortlist')
  @HttpCode(200)
  shortlist(
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body(validate(shortlistSchema)) body: z.infer<typeof shortlistSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leads.shortlistProperty(
      parseId(id),
      parseId(requirementId),
      BigInt(body.propertyId),
      user.id,
    );
  }

  @Delete(':id/requirements/:requirementId/shortlist/:propertyId')
  @HttpCode(200)
  removeShortlist(
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.leads.removeShortlist(parseId(id), parseId(requirementId), parseId(propertyId));
  }
}
