# Morpho indexer

## Getting started
1. install dependencies: `pnpm i`
2. start the DB: `docker-compose up -d postgres`
3. set up local env variables:

### To improve:
- make RPC service multi-chain
- make config multi-chain with "enabled networks" option
- ensure shares/points updates are truly sequential (maybe thru a message queue for all incoming events)
- automated DB migrations
