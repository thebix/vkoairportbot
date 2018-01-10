import { Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import config from '../config'
import token from '../token'
import Telegram from './telegram'
import InputParser from './inputParser'
import help, { flightCheckStart, flightCheckFlightOrCityEntered } from './handlers'
import commands from './commands'

const lastCommands = {}

const mapMessageToHandler = message => {
    const { text, from, chat } = message
    const chatId = chat ? chat.id : from
    if (!config.isProduction && !InputParser.isDeveloper(from)) {
        // TODO: handle non dev user trying dev env
        log(`vkoBot.mapMessageToHandler: userId="${from}" is not in token.developers array.`, logLevel.ERROR)
        return Observable.empty()
    }
    if (InputParser.isAskingForInitToken(text)) {
        // TODO: handle init token
        return Observable.empty()
    }
    if (InputParser.isFlightCheckStart(text)) {
        lastCommands[`${from}${chatId}`] = commands.FLIGHT_CHECK_START
        return flightCheckStart(from, chatId, text)
    }
    if (InputParser.isFlightCheckFlightOrCityEntered(text, lastCommands[`${from}${chatId}`])) {
        return flightCheckFlightOrCityEntered(from, chatId, text)
    }
    return help(from, chatId)
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
        .do(messageToUser => {
            const { userId, chatId, newCommandState } = messageToUser
            if (!newCommandState) {
                log(`vkoBot: handler doesn\\'t provide a new state for userId: ${userId}, chatId: ${chatId}`)
                // TODO: throw
            }
            lastCommands[`${userId}${chatId}`] = newCommandState
        })
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
