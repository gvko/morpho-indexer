import { Injectable } from '@nestjs/common'
import config from '../_config/config'
import { logger } from '../utils/logger'
import { Contract, JsonRpcProvider, TransactionResponse } from 'ethers'
import { hasFirstElement, sleep } from '../utils/helpers'
import { EventName } from '../utils/contract'
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

  /**
   * Returns the balance of a wallet
   *
   * @param {string} address The address of the wallet to check the balance of
   * @returns {Promise<bigint | null>}
   */
  async getWalletBalance(address: string): Promise<bigint | null> {
    try {
      return await this.provider.getBalance(address)
    } catch (err: any) {
      logger.error(
        {
          address,
          code: err.code,
          error: err.message,
        },
        '❌ Error getting wallet balance for an address',
      )
      return null
    }
  }

  /**
   * Returns the balance of an address for a given ERC20 token (contract)
   *
   * @param {string} tokenAddress The address of the token contract on which to check address balance
   * @param {string} address The address of the address to check the balance of
   * @returns {Promise<bigint | null>}
   */
  async getTokenBalance(tokenAddress: string, address: string): Promise<bigint | null> {
    try {
      const tokenContract = new Contract(tokenAddress, ['function balanceOf(address) returns (uint256)'], this.provider)

      return await tokenContract.balanceOf(address)
    } catch (err: any) {
      logger.error(
        {
          address,
          tokenAddress,
          code: err.code,
          error: err.message,
        },
        '❌ Error getting token balance for an address',
      )
      return null
    }
  }

  /**
   * Returns the current height of the network
   *
   * @return {Promise<number>}
   */
  async getCurrentHeight(): Promise<number | null> {
    try {
      return await this.provider.getBlockNumber()
    } catch (err: any) {
      logger.error({ code: err.code, error: err.message }, '❌ Error getting network height')
      return null
    }
  }

  /**
   * Fetches past events of a given contract, that occurred between two given blocks in time
   *
   * @param {Contract}  contract
   * @param {EventName} eventName
   * @param {number}  fromBlock
   * @param {number?} toBlock
   * @returns {Promise<Event[]>}
   */
  async getPastEvents(contract: Contract, eventName: EventName, fromBlock: number, toBlock?: number) {
    const filter = contract.filters[eventName]()
    const endBlock = toBlock || 'latest'

    return await contract.queryFilter(filter, fromBlock, endBlock)
  }

  /**
   * Returns an onchain transaction object by the given tx hash.
   * Null, if the transaction is not found.
   *
   * @param {string} txHash
   * @returns {Promise<TransactionResponse | null>}
   */
  async getTxByHash(txHash: string): Promise<TransactionResponse | null> {
    return await this.provider.getTransaction(txHash)
  }
}
