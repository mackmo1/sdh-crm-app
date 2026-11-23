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
import {
  taskCompleteSchema,
  taskCreateSchema,
  taskListQuerySchema,
  TasksService,
  taskUpdateSchema,
} from './tasks.service.js';

@Controller('tasks')
@UseGuards(SessionGuard, AccessGuard)
@Modules('lead')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Query(validate(taskListQuerySchema)) query: z.infer<typeof taskListQuerySchema>) {
    return this.tasks.list(query);
  }

  @Post()
  create(
    @Body(validate(taskCreateSchema)) body: z.infer<typeof taskCreateSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasks.create(body, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(validate(taskUpdateSchema)) body: z.infer<typeof taskUpdateSchema>,
  ) {
    return this.tasks.update(parseId(id), body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Param('id') id: string,
    @Body(validate(taskCompleteSchema)) body: z.infer<typeof taskCompleteSchema>,
  ) {
    return this.tasks.complete(parseId(id), body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.tasks.cancel(parseId(id));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.tasks.remove(parseId(id));
  }
}
