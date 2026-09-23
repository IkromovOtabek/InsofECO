import { Module } from '@nestjs/common';
import { ProjectsController, TasksController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({ controllers: [ProjectsController, TasksController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}
