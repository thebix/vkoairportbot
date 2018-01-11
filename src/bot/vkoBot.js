import { log, logLevel } from '../logger'
import config from '../config'
import token from '../token'
import Telegram from './telegram'
import mapMessageToHandler from './handlers'

const startVkoBot = () => {
    log('vkoBot.startVkoBot()', logLevel.DEBUG)

    log('starting Telegram bot', logLevel.DEBUG)
    const telegram = new Telegram(config.isProduction ? token.botToken.prod : token.botToken.dev)
    // add to composite subscription and do proper unsubscribe
    telegram.userText()
        // TODO: proper observeOn / subscribeOn
        // .observeOn(Scheduler.async)
        // .subscribeOn(Scheduler.async)
        .mergeMap(mapMessageToHandler)
        .map(message => telegram.messageToUser(message))
        // TODO: handle errors and etc
        .subscribe()

    telegram.userBackAction().subscribe(callbackQuery => {
        log('vkoBot: Callback query received', logLevel.DEBUG)
    })
    telegram.start()
}

export default startVkoBot
