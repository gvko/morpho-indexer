import { Injectable } from '@nestjs/common'
import config from '../_config/config'
import { logger } from '../utils/logger'
import { JsonRpcProvider } from 'ethers'
import { hasFirstElement, sleep } from '../utils/helpers'
import { Network } from '../_config/types'

@Injectable()
export class RpcService {
  provider!: JsonRpcProvider
  private currentUrlIndex: number
  private readonly rpcUrls: string[]
  private readonly network: string

  constructor() {
    this.network = Network.BASE
    this.currentUrlIndex = 0
    this.rpcUrls = config.networks[this.network].rpc.urls
  }

  get instance(): RpcService {
    if (!this.provider) {
      this.init(this.currentUrlIndex)
      this.maintainRpcConnection()
    }

    return this
  }

  get connectionUrl(): URL {
    return new URL(this.provider._getConnection().url)
  }

  /**
   * Initializes or re-initializes RPC provider from a given list
   */
  private init(rpcUrlIndex: number): JsonRpcProvider {
    if (!hasFirstElement<string>(this.rpcUrls)) {
      const err = new Error('❌ RPC provider URLs list cannot be empty!')
      logger.error({ rpcUrls: this.rpcUrls }, err.message)
      throw err
    }

    const provider = new JsonRpcProvider(this.rpcUrls[rpcUrlIndex], undefined, { polling: true })
    provider.pollingInterval = config.networks[this.network].rpc.pollingIntervalMs
    this.provider = provider

    logger.info({ url: this.connectionUrl.toString() }, '🥩 Connected to RPC provider')
    return provider
  }

  /**
   * Rotates to the next available JSON RPC provider URL in the list
   */
  private rotateRpc() {
    const oldRpcUrl = this.rpcUrls[this.currentUrlIndex]
    const newUrlIndex = (this.currentUrlIndex + 1) % this.rpcUrls.length

    const newRpcUrl = this.rpcUrls[newUrlIndex]
    this.currentUrlIndex = newUrlIndex
    this.init(newUrlIndex)

    const logObj = { oldRpcUrl, newRpcUrl }
    if (newRpcUrl === oldRpcUrl) {
      logger.warn(logObj, '🤔 Tried to rotate to the same provider')
    } else {
      logger.info(logObj, '🥩🆕 Switched to next RPC provider')
    }
  }

  /**
   * Checks the connection health to the RPC provider
   *
   * @returns {Promise<boolean>} True if healthy, False otherwise
   */
  private async checkRpcHealth(): Promise<boolean> {
    const maxHealthCheckRetries = 3
    const retryDelay = 1 // initial retry delay in seconds

    for (let retryAttempt = 0; retryAttempt < maxHealthCheckRetries; retryAttempt++) {
      try {
        await this.provider.getBlockNumber()
        return true
      } catch (err: any) {
        logger.warn(
          {
            retryAttempt,
            code: err.code,
            error: err.message,
          },
          '🏥 RPC health check failed. Retrying...',
        )
        await sleep(retryDelay * Math.pow(2, retryAttempt + 1), `Retrying health check`)
      }
    }

    return false
  }

  /**
   * Maintains the RPC connection by continuously checking the health of the current provider
   * and switching to a new provider if the current one becomes unhealthy.
   */
  private async maintainRpcConnection() {
    if (!this.provider) {
      this.init(this.currentUrlIndex)
    }

    while (true) {
      const isHealthy = await this.checkRpcHealth()
      if (!isHealthy) {
        this.rotateRpc()
      }

      await sleep(config.networks[this.network].rpc.healthCheckIntervalSec, 'Waiting between RPC health-checks')
    }
  }
}
