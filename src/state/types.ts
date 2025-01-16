import { Insertable, Selectable, Updateable } from 'kysely'
import { SystemState as DbSystemState } from '../_config/database.types'

export type SystemState = Selectable<DbSystemState>
export type InsertState = Insertable<DbSystemState>
export type UpdateState = Updateable<DbSystemState>
