import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ProjectCreateSchema, ProjectUpdateSchema, TaskCreateSchema, TaskUpdateSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { ProjectsService } from './projects.service';

const MemberSchema = z.object({ userId: z.string() });

@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly s: ProjectsService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext) { return this.s.list(a); }

  @Roles('TADBIRKOR', 'QURUVCHI') @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.get(a, id); }

  @Roles('TADBIRKOR') @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(ProjectCreateSchema)) b: z.infer<typeof ProjectCreateSchema>) { return this.s.create(a, b); }

  @Roles('TADBIRKOR') @Patch(':id')
  update(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(ProjectUpdateSchema)) b: z.infer<typeof ProjectUpdateSchema>) { return this.s.update(a, id, b); }

  @Roles('TADBIRKOR') @Post(':id/members')
  addMember(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(MemberSchema)) b: { userId: string }) { return this.s.addMember(a, id, b.userId); }

  @Roles('TADBIRKOR') @Post(':id/tasks')
  createTask(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(TaskCreateSchema)) b: z.infer<typeof TaskCreateSchema>) { return this.s.createTask(a, id, b); }
}

@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly s: ProjectsService) {}

  @Roles('QURUVCHI', 'TADBIRKOR') @Get('mine')
  mine(@CurrentUser() a: AuthContext) { return this.s.myTasks(a); }

  @Roles('QURUVCHI', 'TADBIRKOR') @Patch(':id')
  update(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(TaskUpdateSchema)) b: z.infer<typeof TaskUpdateSchema>) { return this.s.updateTask(a, id, b); }
}
