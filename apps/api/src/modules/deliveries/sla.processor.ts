import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeliveriesService } from './deliveries.service';

@Processor('sla')
export class SlaProcessor extends WorkerHost {
  constructor(private readonly deliveries: DeliveriesService) {
    super();
  }
  async process(job: Job<{ deliveryId: string }>) {
    await this.deliveries.markSlaBreach(job.data.deliveryId);
  }
}
