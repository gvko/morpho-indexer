import { Module } from '@nestjs/common'
import { RpcModule } from '../rpc/rpc.module'
import { IndexerService } from './indexer.service'
import { UsersModule } from '../users/users.module'
import { StateModule } from '../state/state.module'

@Module({
  imports: [RpcModule, UsersModule, StateModule],
  providers: [IndexerService],
  controllers: [],
})
export class IndexerModule {}
