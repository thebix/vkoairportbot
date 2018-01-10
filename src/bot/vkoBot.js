import { Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import config from '../config'
import token from '../token'
import Telegram from './telegram'
import mapMessageToHandler from './handlers'
import commands from './commands'

const startVkoBot = () => {
    log('vkoBot.startVkoBot()', logLevel.DEBUG)

    log('starting Telegram bot', logLevel.DEBUG)
    const telegram = new Telegram(config.isProduction ? token.botToken.prod : token.botToken.dev)
    telegram.userText()
        // TODO: proper observeOn / subscribeOn
        // .observeOn(Scheduler.async)
        // .subscribeOn(Scheduler.async)
        .mergeMap(mapMessageToHandler)
        .mergeMap(message => telegram.messageToUser(message))
        .subscribe(messageToUser => {
            log(`vkoBot: Text message to send: ${messageToUser.text}`, logLevel.DEBUG)
        })

    telegram.userBackAction().subscribe(callbackQuery => {
        log('vkoBot: Callback query received', logLevel.DEBUG)
    })
    telegram.start()
}

export default startVkoBot
