import { Contract, Interface, Wallet } from 'ethers'
import morpho from './abi/morpho'

export enum EventName {
  Borrow = 'Borrow',
  Repay = 'Repay',
  Liquidate = 'Liquidate',
}

export enum ContractName {
  Morpho = 'Morpho',
}

export const ContractABI: { [name in ContractName]: any } = {
  Morpho: morpho,
}

export interface EventData {
  emitter: {
    target: string
  }
  log: {
    _type: string // 'log'
    address: string
    blockHash: string
    blockNumber: number
    data: string
    index: number
    removed: boolean
    topics: string[]
    transactionHash: string
    transactionIndex: number
  }
  fragment: {
    type: string // 'event'
    inputs: any[]
    name: EventName
    anonymous: boolean
  }
}

export type BorrowEvent = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // onBehalf (address)
  string, // receiver (address)
  bigint, // assets (uint256)
  bigint, // shares (uint256)
  EventData,
]

export type RepayEvent = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // onBehalf (address)
  bigint, // assets (uint256)
  bigint, // shares (uint256)
  EventData,
]

export type LiquidateEvent = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // borrower (address)
  bigint, // repaidAssets (uint256)
  bigint, // repaidShares (uint256)
  bigint, // seizedAssets (uint256)
  bigint, // badDebtAssets (uint256)
  bigint, // badDebtShares (uint256)
  EventData,
]

/**
 * Initializes a contract instance
 *
 * @param {ContractName}  contractName
 * @param {string}  address
 * @param {Wallet?}  signer
 *
 * @returns {Contract}
 */
export function initContract(contractName: ContractName, address: string, signer?: Wallet): Contract {
  const abi = getAbi(contractName)
  return new Contract(address, abi, signer)
}

/**
 * Load the ABI of a contract, parse it as JSON and return.
 *
 * @param {string}  contractName  The ABI file name
 *
 * @returns {Interface}
 */
export function getAbi(contractName: ContractName): Interface {
  try {
    const abi = ContractABI[contractName]
    return abi
  } catch {
    throw new Error(`❌ Failed to load ABI for ${contractName}`)
  }
}
