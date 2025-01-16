import { Controller, Get, Query } from '@nestjs/common'
import { UsersService } from './users.service'

@Controller('leaderboard')
export class UsersController {
  constructor(private readonly pointsService: UsersService) {}

  @Get()
  getTopUsers(@Query('limit') limit: number) {
    return this.pointsService.getTopUsers(limit)
  }
}
