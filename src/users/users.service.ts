import { Inject, Injectable } from '@nestjs/common'
import { db } from '../_config/database'
import { StateService } from '../state/state.service'
import { InsertUser, UpdateUser, User } from './types'

@Injectable()
export class UsersService {
  private readonly tableName = 'users'

  constructor(@Inject(StateService) private readonly stateService: StateService) {}

  /**
   * Distributes points to all users based on the time difference
   * from the last update and their share ratio.
   */
  async updatePointsForAll(currentTimestamp: number) {
    const state = await this.stateService.getCurrent()

    const timeDiffSeconds = currentTimestamp - Number(state.lastUpdate)
    if (timeDiffSeconds <= 0) {
      return
    }

    if (state.totalShares === 0) {
      await this.stateService.update(state.id, { lastUpdate: currentTimestamp })
      return
    }

    const pointsToDistribute = 100 * timeDiffSeconds // 100 points/second

    const users = await this.getAll()

    for (const user of users) {
      const oldPoints = Number(user.points)
      const userShare = Number(user.shares)
      const shareRatio = userShare / state.totalShares
      const accrued = pointsToDistribute * shareRatio

      await this.update(user.address, { points: oldPoints + accrued })
    }

    await this.stateService.update(state.id, { lastUpdate: currentTimestamp })
  }

  /**
   * Handle Borrow event: user gets 'shares' added.
   */
  async borrow(userAddress: string, shares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const user = await this.getByAddress(userAddress)

    if (!user) {
      await this.create({ address: userAddress, points: 0, shares })
    } else {
      await this.update(userAddress, { shares: Number(user.shares) + shares })
    }

    const state = await this.stateService.getCurrent()
    await this.stateService.update(state.id, { totalShares: Number(state.totalShares) + shares })
  }

  /**
   * Handle Repay event: user gets 'shares' removed.
   */
  async repay(userAddress: string, shares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const user = await this.getByAddress(userAddress)
    if (!user) {
      // user not found, nothing to repay
      return
    }

    const oldShares = Number(user.shares)
    const newShares = Math.max(oldShares - shares, 0)
    await this.update(userAddress, { shares: newShares })

    const state = await this.stateService.getCurrent()

    const totalShares = Number(state.totalShares)
    const updatedTotal = Math.max(totalShares - shares, 0)

    await this.stateService.update(state.id, { totalShares: updatedTotal })
  }

  /**
   * Handle Liquidate event: reduce user's shares by repaidShares,
   * and reduce total market shares by badDebtShares.
   */
  async liquidate(userAddress: string, repaidShares: number, badDebtShares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const user = await this.getByAddress(userAddress)

    if (user) {
      const oldShares = Number(user.shares)
      const newShares = Math.max(oldShares - repaidShares, 0)
      await this.update(userAddress, { shares: newShares })
    }

    const state = await this.stateService.getCurrent()

    const totalShares = Number(state.totalShares)
    const adjustedTotal = Math.max(totalShares - badDebtShares, 0)

    await this.stateService.update(state.id, { totalShares: adjustedTotal })
  }

  /**
   * Returns current user points from DB. Make sure to
   * call updatePointsForAll() if you want them accrued to 'now'.
   */
  async getUserPoints(addr: string): Promise<number> {
    const row = await db.selectFrom(this.tableName).where('address', '=', addr).select('points').executeTakeFirst()
    return row ? Number(row.points) : 0
  }

  /**
   * Fetch the top N users by points.
   */
  async getTopUsers(limit = 10) {
    return db.selectFrom(this.tableName).select(['address', 'points']).orderBy('points', 'desc').limit(limit).execute()
  }

  private async getByAddress(address: string): Promise<User | undefined> {
    return await db.selectFrom(this.tableName).selectAll().where('address', '=', address).executeTakeFirst()
  }

  private async getAll(): Promise<User[]> {
    return await db.selectFrom(this.tableName).selectAll().execute()
  }

  private async update(address: string, data: UpdateUser): Promise<User> {
    return (await db.updateTable(this.tableName).set(data).where('address', '=', address).returningAll().execute())[0]
  }

  private async create(data: InsertUser): Promise<User> {
    return (await db.insertInto(this.tableName).values(data).returningAll().execute())[0]
  }
}
