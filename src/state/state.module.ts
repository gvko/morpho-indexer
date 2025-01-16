import { Module } from '@nestjs/common'
import { StateService } from './state.service'

@Module({
  imports: [],
  providers: [StateService],
  controllers: [],
})
export class StateModule {}
