import { log, logLevel } from './logger'
import config from './config'
import startVkoBot from './bot/vkoBot'

log(`Start VkoAirportBot server, environment: ${config.isProduction ? '<Production>' : '<Debug>'}`, logLevel.INFO)

startVkoBot()
