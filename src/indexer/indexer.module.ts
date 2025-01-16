import { Module } from '@nestjs/common'
import { RpcModule } from '../rpc/rpc.module'
import { IndexerService } from './indexer.service'

@Module({
  imports: [RpcModule],
  providers: [IndexerService],
  controllers: [],
})
export class IndexerModule {}
