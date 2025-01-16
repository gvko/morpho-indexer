import { Inject, Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common'
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

    const block = await this.rpc.provider.getBlock(startBlock)
    if (!block) {
      logger.error({ fromBlock: startBlock }, 'Could not fetch block')
      throw new InternalServerErrorException('Could not fetch block')
    }

    for (let fromBlock = startBlock; fromBlock <= headBlock.number; fromBlock += 100) {
      const toBlock = fromBlock + 100

      const logs = await this.rpc.provider.getLogs({
        address: this.morphoContract.getAddress(),
        fromBlock,
        toBlock,
      })

      logs.forEach((log) => this.parseAndProcessLog(log, block.timestamp, block.number, systemState.id))
      logger.info({ fromBlock, toBlock }, 'Blocks processed')
    }
    logger.info('Backfill complete!')
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

  private async parseAndProcessLog(log: Log, blockTimestamp: number, blockNumber: number, stateId: number) {
    const parseLog = this.morphoContract.interface.parseLog(log)
    if (!parseLog) {
      logger.error(log, 'Log could not be parsed')
      throw new InternalServerErrorException('Log could not be parsed')
    }

    // TODO: Optimize: instead of doing DB updates on each event, just return the numbers
    //   and the caller will decide what to do with the data
    switch (parseLog.name) {
      case EventName.Borrow:
        await this.pointsService.borrow(parseLog.args.onBehalf, Number(parseLog.args.shares), blockTimestamp)
        break
      case EventName.Repay:
        await this.pointsService.repay(parseLog.args.onBehalf, Number(parseLog.args.shares), blockTimestamp)
        break
      case EventName.Liquidate:
        await this.pointsService.liquidate(
          parseLog.args.borrower,
          Number(parseLog.args.repaidShares),
          Number(parseLog.args.badDebtShares),
          blockTimestamp,
        )
        break
      default:
        // Ignore unrelated logs
        await this.stateService.update(stateId, { lastBlockIndexed: blockNumber })
    }
  }
}
