import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { RpcModule } from './rpc/rpc.module'
import { IndexerModule } from './indexer/indexer.module'

@Module({
  imports: [RpcModule, IndexerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
