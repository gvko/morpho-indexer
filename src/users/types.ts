import { Insertable, Selectable, Updateable } from 'kysely'
import { User as DbUser } from '../_config/database.types'

export type User = Selectable<DbUser>
export type InsertUser = Insertable<DbUser>
export type UpdateUser = Updateable<DbUser>
