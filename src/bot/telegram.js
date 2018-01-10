import TelegramBot from 'node-telegram-bot-api'
import { Subject, Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import Message, { CallbackQuery } from './message'

export default class Telegram {
    constructor(token) {
        log('Telegram.constructor()', logLevel.DEBUG)
        if (!token) {
            log('Telegram: You should provide a telegram bot token', logLevel.ERROR)
            return
        }
        this.bot = new TelegramBot(token, { polling: true })
        this.userTextSubject = new Subject()
        this.userBackActionSubject = new Subject()
    }
    start() {
        log('Telegram.start()', logLevel.DEBUG)
        if (!this.bot) {
            log('Telegram: Bot hasn\'t initialized yet', logLevel.ERROR)
            return
        }
        this.bot.on('text', msg => {
            this.userTextSubject.next(new Message(Message.mapTelegramMessage(msg)))
        })
        this.bot.on('callback_query', callbackQuery => {
            this.userBackActionSubject.next(new CallbackQuery(CallbackQuery.mapTelegramallbackQuery(callbackQuery)))
        });
    }
    userText() {
        return this.userTextSubject.asObservable()
    }
    userBackAction() {
        return this.userBackActionSubject.asObservable()
    }
    messageToUser({ chatId, text }) {
        return Observable.fromPromise(this.bot.sendMessage(chatId, text))
    }
}
