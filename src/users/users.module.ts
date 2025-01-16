import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { StateModule } from '../state/state.module'

@Module({
  imports: [StateModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
