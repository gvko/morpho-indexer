import { logger } from './logger'

/**
 * Sleep for a given number of seconds.
 *
 * @param {number}  seconds seconds to sleep for
 * @param {string=} reason reason for sleeping
 */
export function sleep(seconds: number, reason?: string): Promise<void> {
  logger.trace({ reason }, `Sleeping for ${seconds} sec...`)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, seconds * 1000)
  })
}

/**
 * Checks if the given array has at least one item.
 * @param arr
 */
export function hasFirstElement<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0
}
