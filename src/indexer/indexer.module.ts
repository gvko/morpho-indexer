import { Module } from '@nestjs/common'
import { RpcModule } from '../rpc/rpc.module'
import { IndexerService } from './indexer.service'
import { PointsModule } from '../points/points.module'
import { StateModule } from '../state/state.module'

@Module({
  imports: [RpcModule, PointsModule, StateModule],
  providers: [IndexerService],
  controllers: [],
})
export class IndexerModule {}
