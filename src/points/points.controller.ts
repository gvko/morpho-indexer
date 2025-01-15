import { Controller, Get, Query } from '@nestjs/common'
import { PointsService } from './points.service'

@Controller('leaderboard')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get()
  getTopUsers(@Query('limit') limit: number) {
    return this.pointsService.getTopUsers(limit)
  }
}
