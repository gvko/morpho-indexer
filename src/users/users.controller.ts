import { Controller, Get, Query } from '@nestjs/common'
import { UsersService } from './users.service'

@Controller('leaderboard')
export class UsersController {
  constructor(private readonly pointsService: UsersService) {}

  @Get()
  getUsersByPoints(@Query('limit') limit: number | undefined) {
    return this.pointsService.getUsersSortedByPoints(limit)
  }
}
