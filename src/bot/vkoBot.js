import { log, logLevel } from '../logger'
import config from '../config'
import token from '../token'
import Telegram from './telegram'
import mapMessageToHandler, { mapCallbackQueryToHandler } from './handlers'

const startVkoBot = () => {
    log('vkoBot.startVkoBot()', logLevel.DEBUG)

    log('starting Telegram bot', logLevel.DEBUG)
    const telegram = new Telegram(config.isProduction ? token.botToken.prod : token.botToken.dev)
    // TODO: add to composite subscription and do proper unsubscribe
    telegram.userText()
        // TODO: proper observeOn / subscribeOn
        // .observeOn(Scheduler.async)
        // .subscribeOn(Scheduler.async)
        .mergeMap(mapMessageToHandler)
        .map(message => {
            return telegram.messageToUser(message)
        })
        // TODO: handle complete if needed
        .subscribe(() => { },
        error => log(`startVkoBot: error while handling userText. Error=${JSON.stringify(error)}`))

    // TODO: add to composite subscription and do proper unsubscribe
    telegram.userBackAction()
        // TODO: proper observeOn / subscribeOn
        // .observeOn(Scheduler.async)
        // .subscribeOn(Scheduler.async)
        .mergeMap(mapCallbackQueryToHandler)
        .map(message => {
            return telegram.messageToUser(message)
        })

        // TODO: handle complete if needed
        .subscribe(() => { },
        error => log(`startVkoBot: error while handling userBackAction. Error=${JSON.stringify(error)}`))
    telegram.start()
}

export default startVkoBot
