import { Selectable } from 'kysely'
import { UserPoint as DbUserPoint } from '../_config/database.types'
import { SystemState as DbSystemState } from '../_config/database.types'

export type SystemState = Selectable<DbSystemState>
export type UserPoint = Selectable<DbUserPoint>
