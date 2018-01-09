import { log, logLevel } from './logger'
import _config from './config'

log(`Start server ${_config.isProduction ? '<Production>' : '<Debug>'}`, logLevel.INFO)
