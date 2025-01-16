import { Injectable } from '@nestjs/common'
import { db } from '../_config/database'
import { SystemState } from "./types";

@Injectable()
export class PointsService {
  /**
   * Call once at initialization (e.g., after getting the starting block's timestamp).
   * If there's no row in system_state, it will create one with the given timestamp.
   */
  async init(): Promise<SystemState> {
    const existingState = await db.selectFrom('systemState').selectAll().executeTakeFirst()

    if (!existingState) {
      return await db
        .insertInto('systemState')
        .values({
          totalShares: 0,
          lastUpdate: Date.now() / 1000,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    return existingState
  }

  /**
   * Distributes points to all users based on the time difference
   * from the last update and their share ratio.
   */
  async updatePointsForAll(currentTimestamp: number) {
    const state = await db.selectFrom('systemState').selectAll().limit(1).executeTakeFirstOrThrow()

    const timeDiff = currentTimestamp - Number(state.lastUpdate)
    if (timeDiff <= 0) return

    const totalShares = Number(state.totalShares)
    if (totalShares === 0) {
      await db.updateTable('systemState').set({ lastUpdate: currentTimestamp }).where('id', '=', state.id).execute()
      return
    }

    const pointsToDistribute = 100 * timeDiff // 100 points/second

    const users = await db.selectFrom('userPoints').select(['address', 'points', 'shares']).execute()

    for (const user of users) {
      const oldPoints = Number(user.points)
      const userShare = Number(user.shares)
      const shareRatio = userShare / totalShares
      const accrued = pointsToDistribute * shareRatio
      await db
        .updateTable('userPoints')
        .set({ points: oldPoints + accrued })
        .where('address', '=', user.address)
        .execute()
    }

    await db.updateTable('systemState').set({ lastUpdate: currentTimestamp }).where('id', '=', state.id).execute()
  }

  /**
   * Handle Borrow event: user gets 'shares' added.
   */
  async borrow(userAddress: string, shares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const currentUser = await db
      .selectFrom('userPoints')
      .selectAll()
      .where('address', '=', userAddress)
      .executeTakeFirst()

    if (!currentUser) {
      await db
        .insertInto('userPoints')
        .values({
          address: userAddress,
          points: 0,
          shares,
        })
        .execute()
    } else {
      await db
        .updateTable('userPoints')
        .set({ shares: Number(currentUser.shares) + shares })
        .where('address', '=', userAddress)
        .execute()
    }

    const state = await db.selectFrom('systemState').selectAll().limit(1).executeTakeFirstOrThrow()

    await db
      .updateTable('systemState')
      .set({ totalShares: Number(state.totalShares) + shares })
      .where('id', '=', state.id)
      .execute()
  }

  /**
   * Handle Repay event: user gets 'shares' removed.
   */
  async repay(userAddress: string, shares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const user = await db.selectFrom('userPoints').selectAll().where('address', '=', userAddress).executeTakeFirst()

    if (!user) {
      // user not found, nothing to repay
      return
    }

    const oldShares = Number(user.shares)
    const newShares = Math.max(oldShares - shares, 0)

    await db.updateTable('userPoints').set({ shares: newShares }).where('address', '=', userAddress).execute()

    const state = await db.selectFrom('systemState').selectAll().limit(1).executeTakeFirstOrThrow()

    const totalShares = Number(state.totalShares)
    const updatedTotal = Math.max(totalShares - shares, 0)

    await db.updateTable('systemState').set({ totalShares: updatedTotal }).where('id', '=', state.id).execute()
  }

  /**
   * Handle Liquidate event: reduce user's shares by repaidShares,
   * and reduce total market shares by badDebtShares.
   */
  async liquidate(userAddress: string, repaidShares: number, badDebtShares: number, timestamp: number) {
    await this.updatePointsForAll(timestamp)

    const currentUser = await db
      .selectFrom('userPoints')
      .selectAll()
      .where('address', '=', userAddress)
      .executeTakeFirst()

    if (currentUser) {
      const oldShares = Number(currentUser.shares)
      const newShares = Math.max(oldShares - repaidShares, 0)
      await db.updateTable('userPoints').set({ shares: newShares }).where('address', '=', userAddress).execute()
    }

    const state = await db.selectFrom('systemState').selectAll().limit(1).executeTakeFirstOrThrow()

    const totalShares = Number(state.totalShares)
    const adjustedTotal = Math.max(totalShares - badDebtShares, 0)

    await db.updateTable('systemState').set({ totalShares: adjustedTotal }).where('id', '=', state.id).execute()
  }

  /**
   * Returns current user points from DB. Make sure to
   * call updatePointsForAll() if you want them accrued to 'now'.
   */
  async getUserPoints(addr: string): Promise<number> {
    const row = await db.selectFrom('userPoints').where('address', '=', addr).select('points').executeTakeFirst()
    return row ? Number(row.points) : 0
  }

  /**
   * Fetch the top N users by points.
   */
  async getTopUsers(limit = 10) {
    return db.selectFrom('userPoints').select(['address', 'points']).orderBy('points', 'desc').limit(limit).execute()
  }
}
