import { Inject, Injectable } from '@nestjs/common'
import { db } from '../_config/database'
import { StateService } from '../state/state.service'
import { InsertUser, UpdateUser, User } from './types'
import { SystemState } from '../state/types'
import { logger } from '../utils/logger'

@Injectable()
export class UsersService {
  private readonly tableName = 'users'

  constructor(@Inject(StateService) private readonly stateService: StateService) {}

  /**
   * Distributes points to all users based on the time difference
   * from the last update and their share ratio.
   */
  async updatePointsForAll(eventTimestamp: number, state: SystemState) {
    const timeDiffSeconds = eventTimestamp - Number(state.lastUpdate)
    if (timeDiffSeconds <= 0) {
      return
    }

    if (state.totalShares === 0) {
      return
    }

    const pointsToDistribute = 100 * timeDiffSeconds // 100 points/second

    const users = await this.getAll()

    for (const user of users) {
      const oldPoints = Number(user.points)
      const userShare = Number(user.shares)
      const shareRatio = userShare / state.totalShares
      const accrued = pointsToDistribute * shareRatio
      const newPoints = oldPoints + accrued

      await this.update(user.address, { points: newPoints })
      logger.info({ userAddress: user.address, newPoints }, 'Recalculated points for user')
    }

    await this.stateService.update(state.id, { lastUpdate: eventTimestamp })
  }

  /**
   * Handle Borrow event: user gets 'shares' added.
   */
  async borrow(userAddress: string, shares: number, eventTimestamp: number) {
    const user = await this.getByAddress(userAddress)

    let oldShares = 0
    let newShares = 0

    if (!user) {
      await this.create({ address: userAddress, points: 0, shares })
    } else {
      oldShares = Number(user.shares)
      newShares = oldShares + shares
      await this.update(userAddress, { shares: newShares })
    }
    logger.info({ userAddress, shares, oldShares, newShares }, 'Borrow: added shares for user')

    const state = await this.stateService.getCurrentState()

    const totalShares = Number(state.totalShares) + shares
    const newState = await this.stateService.update(state.id, {
      totalShares,
      lastUpdate: eventTimestamp,
    })

    await this.updatePointsForAll(eventTimestamp, newState)
  }

  /**
   * Handle Repay event: user gets 'shares' removed.
   */
  async repay(userAddress: string, shares: number, eventTimestamp: number) {
    const user = await this.getByAddress(userAddress)

    if (user) {
      const oldShares = Number(user.shares)
      const newShares = Math.max(oldShares - shares, 0)

      await this.update(userAddress, { shares: newShares })
      logger.info({ userAddress, shares, oldShares, newShares }, 'Repay: removed shares for user')
    } else {
      // user not found, nothing to repay
      logger.error(
        { userAddress, shares, eventTimestamp },
        'Tried to repay shares for non-existent user. Should not happen!',
      )
    }

    const state = await this.stateService.getCurrentState()

    const totalShares = Math.max(Number(state.totalShares) - shares, 0)
    const newState = await this.stateService.update(state.id, {
      totalShares,
      lastUpdate: eventTimestamp,
    })

    await this.updatePointsForAll(eventTimestamp, newState)
  }

  /**
   * Handle Liquidate event: reduce user's shares by repaidShares and reduce total market shares by badDebtShares.
   */
  async liquidate(userAddress: string, repaidShares: number, badDebtShares: number, eventTimestamp: number) {
    const user = await this.getByAddress(userAddress)

    if (user) {
      const oldShares = Number(user.shares)
      const newShares = Math.max(oldShares - repaidShares, 0)

      await this.update(userAddress, { shares: newShares })
      logger.info({ userAddress, repaidShares, oldShares, newShares }, 'Liquidate: removed shares for user')
    } else {
      // user not found, nothing to repay
      logger.error(
        { userAddress, repaidShares, badDebtShares, eventTimestamp },
        'Tried to liquidate shares for non-existent user. Should not happen!',
      )
    }

    const state = await this.stateService.getCurrentState()

    const totalShares = Math.max(Number(state.totalShares) - badDebtShares - repaidShares, 0)
    const newState = await this.stateService.update(state.id, {
      totalShares,
      lastUpdate: eventTimestamp,
    })

    await this.updatePointsForAll(eventTimestamp, newState)
  }

  /**
   * Fetch the users by points.
   */
  async getUsersSortedByPoints(limit: number = 10) {
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
