import { Controller, Get } from '@nestjs/common'
import { UsersService } from './users.service'

@Controller('leaderboard')
export class UsersController {
  constructor(private readonly pointsService: UsersService) {}

  @Get()
  getUsersByPoints() {
    return this.pointsService.getUsersSortedByPoints()
  }
}
