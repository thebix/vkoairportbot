import TelegramBot from 'node-telegram-bot-api'
import { Subject, Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import Message, { CallbackQuery } from './message'

const messageToUserOptions = (inlineButtons, editMessageId = undefined, editMessageChatId = undefined) => {
    const options = {
        message_id: editMessageId,
        chat_id: editMessageChatId,
        reply_markup: {}
    }
    if (inlineButtons && Array.isArray(inlineButtons)) {
        options.reply_markup.inline_keyboard =
            inlineButtons.map(item => [{
                text: item.text,
                callback_data: JSON.stringify(item.callbackData)
            }])

    }
    return options
}

export default class Telegram {
    constructor(token) {
        log('Telegram.constructor()', logLevel.DEBUG)
        if (!token) {
            log('Telegram: You should provide a telegram bot token', logLevel.ERROR)
            return
        }
        this.bot = new TelegramBot(token, { polling: true })
        this.userTextSubject = new Subject()
        this.userActionsSubject = new Subject()
    }
    // TODO: ?move start() content to constructor. bot will emit items on subscription?
    start() {
        log('Telegram.start()', logLevel.DEBUG)
        if (!this.bot) {
            log('Telegram: Bot does\'t initialized yet', logLevel.ERROR)
            return
        }
        this.bot.on('text', msg => {
            this.userTextSubject.next(new Message(Message.mapTelegramMessage(msg)))
        })
        this.bot.on('callback_query', callbackQuery => {
            this.bot.answerCallbackQuery(callbackQuery.id, 'Команда получена', false);
            this.userActionsSubject.next(new CallbackQuery(CallbackQuery.mapTelegramCallbackQuery(callbackQuery)))
        })
    }
    userText() {
        // TODO: try to do this thru Observable.fromEvent(this.bot.on('text')) or something else
        return this.userTextSubject.asObservable()
    }
    userActions() {
        // TODO: try to do this thru Observable.fromEvent(this.bot.on('callback_query')) or something else
        return this.userActionsSubject.asObservable()
    }
    // TODO: rename to botMessage
    messageToUser({ chatId, text, inlineButtons }) {
        return Observable.fromPromise(this.bot.sendMessage(chatId, text,
            messageToUserOptions(inlineButtons)))
    }
    // TODO: rename to botMessageEdit
    messageToUserEdit({ chatId, text, inlineButtons, messangerMessageIdToEdit }) {
        // TODO: chatId, messangerMessageIdToEdit is required params - add checks isNonBlank()
        return Observable.fromPromise(this.bot.editMessageText(text,
            messageToUserOptions(inlineButtons, messangerMessageIdToEdit, chatId)))
    }
}
