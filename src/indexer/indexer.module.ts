import { Module } from '@nestjs/common'
import { RpcModule } from '../rpc/rpc.module'

@Module({
  imports: [RpcModule],
  providers: [],
  controllers: [],
})
export class IndexerModule {}
