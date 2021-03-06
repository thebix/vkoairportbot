import TelegramBot from 'node-telegram-bot-api'
import { Subject, Observable } from 'rxjs'
import { log, logLevel } from '../logger'
import UserMessage, { UserAction } from './message'

const messageToUserOptions = (inlineButtons = undefined, replyKeyboard = undefined, editMessageId = undefined, editMessageChatId = undefined) => {
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
    if (replyKeyboard && replyKeyboard.buttons && Array.isArray(replyKeyboard.buttons)) {
        const {
            buttons = [],
            resizeKeyboard = false,
            oneTimeKeyboard = false,
            selective = false } = replyKeyboard

        options.reply_markup.resize_keyboard = resizeKeyboard
        options.reply_markup.one_time_keyboard = oneTimeKeyboard
        options.reply_markup.selective = selective
        options.reply_markup.keyboard =
            buttons.map(item => [{
                text: item.text
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
            this.userTextSubject.next(new UserMessage(UserMessage.mapTelegramMessage(msg)))
        })
        this.bot.on('callback_query', userAction => {
            this.bot.answerCallbackQuery(userAction.id, 'Команда получена', false);
            this.userActionsSubject.next(new UserAction(UserAction.mapTelegramUserAction(userAction)))
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
    messageToUser({ chatId, text, inlineButtons, replyKeyboard }) {
        return Observable.fromPromise(this.bot.sendMessage(chatId, text,
            messageToUserOptions(inlineButtons, replyKeyboard)))
    }
    // TODO: rename to botMessageEdit
    messageToUserEdit({ chatId, text, inlineButtons, messangerMessageIdToEdit }) {
        // TODO: chatId, messangerMessageIdToEdit is required params - add checks isNonBlank()
        return Observable.fromPromise(this.bot.editMessageText(text,
            messageToUserOptions(inlineButtons, undefined, messangerMessageIdToEdit, chatId)))
    }
}
