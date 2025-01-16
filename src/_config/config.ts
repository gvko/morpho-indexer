import * as dotenv from 'dotenv'
import envVar from 'env-var'
import { Environment, LogLevel } from './types'

const dotEnvLoadSettings = process.env.NODE_ENV === Environment.test ? { path: '.env.test' } : undefined
dotenv.config(dotEnvLoadSettings)
const get = envVar.get

/* BEGIN: Custom env config logic */

/* END: Custom env config logic */

const config = {
  env: get('NODE_ENV').required().default(Environment.local).asEnum(Object.values(Environment)),
  app: {
    port: get('SERVER_PORT').required().default(3000).asIntPositive(),
    name: get('SERVICE_NAME').required().asString(),
  },
  log: {
    level: get('LOG_LEVEL').required().default(LogLevel.DEBUG).asEnum(Object.values(LogLevel)),
    pretty: get('LOG_PRETTY').required().default('false').asBoolStrict(),
  },
  postgres: {
    host: get('POSTGRES_HOST').required().asString(),
    port: get('POSTGRES_PORT').required().asIntPositive(),
    user: get('POSTGRES_USER').required().asString(),
    password: get('POSTGRES_PASSWORD').required().asString(),
    dbName: get('POSTGRES_DBNAME').required().asString(),
  },
  networks: {
    base: {
      rpc: {
        urls: get('BASE_RPC_PROVIDER_URLS').required().asArray(),
        pollingIntervalMs: get('BASE_RPC_POLLING_INTERVAL_MS').required().asIntPositive(),
        healthCheckIntervalSec: get('BASE_RPC_HEALTH_CHECK_INTERVAL_SEC').required().default(3).asIntPositive(),
      },
      contracts: {
        morpho: get('BASE_MORPHO_CONTRACT_ADDRESS').required().asString(),
      },
      privateKey: get('BASE_WALLET_PRIVATE_KEY').required().asString(),
    },
  },
  indexer: {
    blocksToQueryAtOnce: get('INDEXER_BLOCKS_TO_QUERY_AT_ONCE').default(1000).asIntPositive(),
  },
}

export default config
export type Config = typeof config
