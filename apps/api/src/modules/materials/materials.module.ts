import { Module } from '@nestjs/common';
import { MaterialRequestsController, MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({ controllers: [MaterialsController, MaterialRequestsController], providers: [MaterialsService], exports: [MaterialsService] })
export class MaterialsModule {}
