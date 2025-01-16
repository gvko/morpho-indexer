import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { RpcModule } from './rpc/rpc.module'
import { IndexerModule } from './indexer/indexer.module'
import { UsersModule } from './users/users.module'
import { StateModule } from './state/state.module'

@Module({
  imports: [RpcModule, IndexerModule, UsersModule, StateModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
