import { execSync } from 'child_process'
import config from '../src/_config/config'

try {
  const databaseUrl = `postgresql://${config.postgres.user}:${config.postgres.password}@${config.postgres.host}:${config.postgres.port}/${config.postgres.dbName}`
  const tables = ['user_points', 'system_state']
  const typeOverrides = {
    columns: {},
  }
  const command = `kysely-codegen --camel-case --out-file ./src/_config/database.types.ts --include-pattern='public.+(${[...tables].join('|')})' --url='${databaseUrl}' --singular --runtime-enums --numeric-parser='number' --overrides='${JSON.stringify(typeOverrides)}' --log-level=debug`

  execSync(command, { stdio: 'inherit' })
} catch (error) {
  console.error('Error running kysely-codegen:', error)
  process.exit(1)
}
