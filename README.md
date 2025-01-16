# Morpho indexer

## Getting started
1. install dependencies: `pnpm i`
2. start the DB: `docker-compose up -d postgres`
3. execute the migrations from each file under `/migrations`
4. set up local env variables: create a new file `.env` (it's git-ignored) and copy-paste into it the contents of the `.env.test` file. Ideally, you should provide more than one RPC http urls (comma-separated) for the `BASE_RPC_PROVIDER_URLS` env var. This will allow for RPC provider rotation in case the current active one fails healthcheck.
5. start the service: `pnpm start` (or `pnpm start:dev` to run with `nodemon` and restart on src file changes)

## Architecture
The service architecture follows a DDD approach. There are several modules, each taking care of its own domain:
- config - takes care of loading env configs (e.g. when deploying we can pass config & secrets to the container) and also serves as a central, type-safe instance of the global application configuration, so it can be accessed from any module. Also, contains the DB init module. This could be refactored into a separate module, if it grows or if we start adding more data stores.
- indexer - takes care of indexing the contract and listening for incoming events
- rpc - takes care of initializing connection to the RPC provider, and also maintaining it. There is active health check going on, so that the RPC provider can be rotated in case of connection failure.
- state - all operations related to the `system_state` entity, mainly CRUD
- users - all operations related to the `users` entity, mainly CRUD, but also handling the business logic around shares & points calculation


The current scope is small, but in real-world scenarios this would allow for easy splitting of any of the modules into separate deployable services, if the need arises.

## Commands for local dev
- `pnpm precommit` - runs fmt, fmt:check, lint and typescript build commands
- `pnpm fmt` - runs prettier to format the code
- `pnpm fmt:check` - runs prettier to check whether the code is formatted according to set standards
- `pnpm lint` - runs eslint to lint the code
- `pnpm start` - runs the app
- `pnpm start:dev` - runs the app with nodemon (app will restart automatically upon src file changes)

### To improve:
- make RPC service multi-chain
- make config multi-chain with "enabled networks" option for easy switching off/on of any network
- ensure shares/points updates are truly sequential (maybe thru a message queue for all incoming events)
- automated DB migrations
- add tests
- add CI pipeline
- better error handling and logs of certain operations and scenarios like updates to the DB or log parsing
