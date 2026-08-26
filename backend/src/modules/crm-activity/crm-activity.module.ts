import { Module } from '@nestjs/common';
import { CrmActivityService } from './crm-activity.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CrmActivityService],
  exports: [CrmActivityService],
})
export class CrmActivityModule {}
