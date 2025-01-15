import { Module } from '@nestjs/common'
import { RpcService } from './rpc.service'

@Module({
  imports: [],
  controllers: [],
  providers: [RpcService],
  exports: [RpcService],
})
export class RpcModule {}
