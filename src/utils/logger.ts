import pino from 'pino'
import config from '../_config/config'
import { Environment } from '../_config/types'

const isTestEnv = config.env === Environment.test

const consoleTransport = pino.transport({
  target: 'pino-pretty',
})

const streams = [{ level: config.log.level, stream: config.log.pretty ? consoleTransport : process.stdout }]

const logger = pino(
  {
    enabled: !isTestEnv,
    base: { name: config.app.name },
  },
  pino.multistream(streams),
)

export { logger }
export type Logger = pino.Logger
