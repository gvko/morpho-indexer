import { Contract, Interface, Wallet } from 'ethers'

export enum EventName {
  Borrow = 'Borrow',
  Repay = 'Repay',
  Liquidate = 'Liquidate',
}

export enum ContractName {
  Morpho = 'Morpho',
}

export const ContractABI: { [name in ContractName]: any } = {
  Morpho: [
    `event Borrow(
    (uint256) id,
    address caller,
    address onBehalf,
    address receiver,
    uint256 assets,
    uint256 shares
  )`,
    `event Repay(
    (uint256) id,
    address caller,
    address onBehalf,
    uint256 assets,
    uint256 shares
  )`,
    `event Liquidate(
    (uint256) id,
    address caller,
    address borrower,
    uint256 repaidAssets,
    uint256 repaidShares,
    uint256 seizedAssets,
    uint256 badDebtAssets,
    uint256 badDebtShares
  )`,
  ],
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

export type Borrow = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // onBehalf (address)
  string, // receiver (address)
  bigint, // assets (uint256)
  bigint, // shares (uint256)
]

export type Repay = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // onBehalf (address)
  bigint, // assets (uint256)
  bigint, // shares (uint256)
]

export type Liquidate = [
  bigint, // id (uint256)
  string, // caller (address)
  string, // borrower (address)
  bigint, // repaidAssets (uint256)
  bigint, // repaidShares (uint256)
  bigint, // seizedAssets (uint256)
  bigint, // badDebtAssets (uint256)
  bigint, // badDebtShares (uint256)
]

/**
 * Initializes a contract instance
 *
 * @param {ContractName}  contractName
 * @param {string}  address
 * @param {Wallet}  signer
 *
 * @returns {Contract}
 */
export function initContract(contractName: ContractName, address: string, signer: Wallet): Contract {
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
