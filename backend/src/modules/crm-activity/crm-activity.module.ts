import { Module } from '@nestjs/common';
import { CrmActivityController } from './crm-activity.controller';
import { CrmActivityService } from './crm-activity.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SecurityModule } from '../../security/security.module';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [CrmActivityController],
  providers: [CrmActivityService],
  exports: [CrmActivityService],
})
export class CrmActivityModule {}
