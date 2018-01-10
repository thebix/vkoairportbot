import { Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import config from '../config'
import token from '../token'
import Telegram from './telegram'
import InputParser from './inputParser'
import help from './handlers'

const mapMessageToHandler = message => {
    const { text, from, chat } = message
    if (!config.isProduction && !InputParser.isDeveloper(from)) {
        // TODO: handle non dev user trying dev env
        log(`vkoBot.mapMessageToHandler: userId="${from}" is not in token.developers array.`, logLevel.ERROR)
        return Observable.empty()
    }
    if (InputParser.isAskingForInitToken(text)) {
        // TODO: handle init token
        return Observable.empty()
    }
    // if (InputParser.isAskingForEcho())
    //     return Observable.of(text)
    return help(from, chat ? chat.id : from)
}

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
            log(`vkoBot: Text message received: ${messageToUser.text}`, logLevel.DEBUG)
        })

    telegram.userBackAction().subscribe(callbackQuery => {
        log('vkoBot: Callback query received', logLevel.DEBUG)
    })
    telegram.start()
}

export default startVkoBot
