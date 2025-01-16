import { Injectable } from '@nestjs/common'
import { db } from '../_config/database'
import { InsertState, SystemState, UpdateState } from './types'

@Injectable()
export class StateService {
  /**
   * Call once at initialization (e.g., after getting the starting block's timestamp).
   * If there's no row in system_state, it will create one with the given timestamp.
   */
  async init(): Promise<SystemState> {
    const existingState = await this.getCurrent()

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

  async getCurrent(): Promise<SystemState> {
    return await db.selectFrom('systemState').selectAll().limit(1).executeTakeFirstOrThrow()
  }

  async update(id: number, data: UpdateState): Promise<SystemState> {
    return (await db.updateTable('systemState').set(data).where('id', '=', id).returningAll().execute())[0]
  }

  async create(data: InsertState): Promise<SystemState> {
    return await db.insertInto('systemState').values(data).returningAll().executeTakeFirstOrThrow()
  }
}
