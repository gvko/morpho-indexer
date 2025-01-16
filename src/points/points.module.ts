import { Module } from '@nestjs/common'
import { PointsService } from './points.service'
import { PointsController } from './points.controller'
import { StateModule } from '../state/state.module'

@Module({
  imports: [StateModule],
  providers: [PointsService],
  controllers: [PointsController],
})
export class PointsModule {}
