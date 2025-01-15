import { Pool, types } from 'pg'
import { DB } from './database.types'
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import config from './config'

// cast DECIMAL to number
types.setTypeParser(1700, parseFloat)

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.dbName,
      max: 10,
    }),
  }),
  plugins: [new CamelCasePlugin()],
})
