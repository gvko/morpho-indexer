import { Injectable } from '@nestjs/common'

@Injectable()
export class PointsService {
  constructor() {}

  async getTopUsers(_limit: number): Promise<void> {}
}
