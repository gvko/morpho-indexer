import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { Contract, EventLog, Log } from 'ethers'
import { RpcService } from '../rpc/rpc.service'
import { UsersService } from '../users/users.service'
import { BorrowEvent, ContractName, EventName, initContract, LiquidateEvent, RepayEvent } from '../utils/contract'
import config from '../_config/config'
import { logger } from '../utils/logger'
import { Network } from '../_config/types'
import { StateService } from '../state/state.service'

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly rpc: RpcService
  private readonly morphoContract: Contract
  private readonly network: Network

  constructor(
    @Inject(RpcService) private readonly rpcService: RpcService,
    @Inject(StateService) private readonly stateService: StateService,
    @Inject(UsersService) private readonly pointsService: UsersService,
  ) {
    this.network = Network.BASE
    this.rpc = this.rpcService.instance
    this.morphoContract = initContract(ContractName.Morpho, config.networks[this.network].contracts.morpho)
  }

  async onModuleInit() {
    this.init()
  }

  /**
   * Have separate init method, so that we can trigger the backfill and let NestJS finish initializing
   * the rest of the app. Otherwise, the app won't finish initializing until the backfill is complete.
   */
  async init() {
    await this.backfillEvents()

    this.listenBorrowEvents()
    this.listenRepayEvents()
    this.listenLiquidateEvents()
  }

  private async backfillEvents() {
    const systemState = await this.stateService.init()
    const startBlock = Number(systemState.lastBlockIndexed)

    logger.info({ fromBlock: startBlock }, 'Start backfill')

    const headBlock = await this.rpc.provider.getBlock('latest')
    if (!headBlock) {
      logger.error('🚨Failed to get head block')
      return
    }
    const endBlock = headBlock.number

    for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += config.indexer.blocksToQueryAtOnce) {
      const toBlock = fromBlock + config.indexer.blocksToQueryAtOnce

      const logs = await this.rpc.provider.getLogs({
        address: this.morphoContract.getAddress(),
        fromBlock,
        toBlock,
      })

      if (logs.length > 0) {
        logs.forEach((log) => this.parseAndProcessLog(log, log.blockNumber, systemState.id))
      } else {
        await this.stateService.update(systemState.id, { lastBlockIndexed: toBlock })
      }
      logger.info({ fromBlock, toBlock }, 'Blocks processed')
    }
    logger.info('Backfill complete!')
  }

  private async parseAndProcessLog(log: Log, blockNumber: number, stateId: number) {
    const parsedLog = this.morphoContract.interface.parseLog(log)
    if (!parsedLog) {
      logger.error(log, 'Log could not be parsed')
      await this.stateService.update(stateId, { lastBlockIndexed: blockNumber })
      return
    }

    const timestampSec = Date.now() / 1000

    // TODO: Optimize: instead of doing DB updates on each event, just return the numbers
    //   and the caller will decide what to do with the data
    switch (parsedLog.name) {
      case EventName.Borrow:
        await this.pointsService.borrow(parsedLog.args.onBehalf, Number(parsedLog.args.shares), timestampSec)
        break
      case EventName.Repay:
        await this.pointsService.repay(parsedLog.args.onBehalf, Number(parsedLog.args.shares), timestampSec)
        break
      case EventName.Liquidate:
        await this.pointsService.liquidate(
          parsedLog.args.borrower,
          Number(parsedLog.args.repaidShares),
          Number(parsedLog.args.badDebtShares),
          timestampSec,
        )
        break
      default:
        // Ignore unrelated logs
        await this.stateService.update(stateId, { lastBlockIndexed: blockNumber })
    }
  }

  /**
   * Listens to Borrow events on the Morpho contract
   */
  private listenBorrowEvents() {
    const eventName = EventName.Borrow
    logger.info(
      { address: config.networks[this.network].contracts.morpho },
      `⏳ Listening for ${eventName} events on Morpho contract`,
    )

    this.morphoContract.on(eventName, async (...args: BorrowEvent) => {
      const [_id, _caller, onBehalf, _receiver, _assets, shares, eventData] = args
      const blockTimestamp = eventData.log.blockNumber // TODO: should be timestamp

      try {
        await this.pointsService.borrow(onBehalf, Number(shares), blockTimestamp)
      } catch (err: any) {
        logger.error(
          {
            error: err.message,
            onBehalf,
            shares: Number(shares),
          },
          'Could not process Borrow event',
        )
        // TODO: implement retry
      }
    })
  }

  /**
   * Listens to Repay events on the Morpho contract
   */
  private listenRepayEvents() {
    const eventName = EventName.Repay
    logger.info(
      { address: config.networks[this.network].contracts.morpho },
      `⏳ Listening for ${eventName} events on Morpho contract`,
    )

    this.morphoContract.on(eventName, async (...args: RepayEvent) => {
      const [_id, _caller, onBehalf, _assets, shares, eventData] = args
      const blockTimestamp = eventData.log.blockNumber // TODO: should be timestamp

      try {
        await this.pointsService.borrow(onBehalf, Number(shares), blockTimestamp)
      } catch (err: any) {
        logger.error(
          {
            error: err.message,
            onBehalf,
            shares: Number(shares),
          },
          'Could not process Repay event',
        )
        // TODO: implement retry
      }
    })
  }

  /**
   * Listens to Liquidate events on the Morpho contract
   */
  private listenLiquidateEvents() {
    const eventName = EventName.Liquidate
    logger.info(
      { address: config.networks[this.network].contracts.morpho },
      `⏳ Listening for ${eventName} events on Morpho contract`,
    )

    this.morphoContract.on(eventName, async (...args: LiquidateEvent) => {
      const [
        _id,
        _caller,
        borrower,
        _repaidAssets,
        repaidShares,
        _seizedAssets,
        _badDebtAssets,
        badDebtShares,
        eventData,
      ] = args
      const blockTimestamp = eventData.log.blockNumber // TODO: should be timestamp

      try {
        await this.pointsService.liquidate(borrower, Number(repaidShares), Number(badDebtShares), blockTimestamp)
      } catch (err: any) {
        logger.error(
          {
            error: err.message,
            borrower,
            repaidShares: Number(repaidShares),
            badDebtShares: Number(badDebtShares),
          },
          'Could not process Liquidate event',
        )
        // TODO: implement retry
      }
    })
  }

  /**
   * Retrieves events of a specified type from the onchain contract within a given block range.
   *
   * @param {EventName} eventName
   * @param {number}  fromBlock
   * @param {number}  toBlock
   * @returns {Promise<EventLog[]>}
   */
  private async getEvents(eventName: EventName, fromBlock: number, toBlock: number): Promise<EventLog[]> {
    try {
      return (await this.morphoContract.queryFilter(eventName, fromBlock, toBlock)) as EventLog[]
    } catch (err: any) {
      logger.error(
        {
          error: err.message,
          code: err.code,
          fromBlock,
          toBlock,
        },
        `Failed to query ${eventName} events from contract`,
      )
      // TODO: implement retry for the given block range
      return []
    }
  }
}
