import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import helmet from 'helmet'
import config from './_config/config'
import { logger } from './utils/logger'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const serverPort = config.app.port
  const app = await NestFactory.create(AppModule)
  app.use(helmet())

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform payloads to DTO instances
      whitelist: true, // Strip properties that do not have decorators
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
    }),
  )

  try {
    await app.listen(serverPort)
    logger.info({ logLevel: config.log.level }, `🚀 Service running on localhost:${serverPort}`)
  } catch (err: unknown) {
    logger.error('Failed to start server', (err as Error).message)
    throw err
  }
}
bootstrap()
