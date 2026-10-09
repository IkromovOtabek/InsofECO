import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentWatchService } from './shipment-watch.service';

@Module({ controllers: [ShipmentsController], providers: [ShipmentsService, ShipmentWatchService] })
export class ShipmentsModule {}
