// https://core.telegram.org/bots/api#user

/*
 *   FROM USER
 */
export default class Message {
    constructor(msg) {
        this.id = msg.id
        this.from = msg.from
        this.text = msg.text
        this.user = msg.user
        this.chat = msg.chat
    }

    static mapTelegramMessage(msg) {
        return {
            id: msg.message_id,
            from: msg.from.id,
            text: msg.text,
            user: {
                id: msg.from.id,
                firstName: msg.from.first_name,
                lastName: msg.from.last_name,
                username: msg.from.username
            },
            chat: {
                id: msg.chat.id,
                type: msg.chat.type,
                title: msg.chat.title,
                username: msg.chat.username,
                firstName: msg.chat.first_name,
                lastName: msg.chat.last_name,
                allMembersAdmins: msg.chat.all_members_are_administrators
            }
        }
    }
    static mapTelegramCallbackQueryToMessage(callbackQuery) {
        // INFO: message.user = bot, from = user
        const { message, from } = callbackQuery
        return {
            id: message.message_id,
            from: from.id,
            text: message.text,
            user: {
                id: from.id,
                firstName: from.first_name,
                lastName: from.last_name,
                username: from.username
            },
            chat: {
                id: message.chat.id,
                type: message.chat.type,
                title: message.chat.title,
                username: message.chat.username,
                firstName: message.chat.first_name,
                lastName: message.chat.last_name,
                allMembersAdmins: !!message.chat.all_members_are_administrators
            }
        }
    }
}

// TODO: ?rename to userActions?
export class CallbackQuery {
    constructor({ data, message }) {
        this.data = data
        this.message = message
    }

    static mapTelegramCallbackQuery(callbackQuery) {
        const { data, message } = callbackQuery
        return {
            data: data ? JSON.parse(data) : {},
            message: new Message(Message.mapTelegramCallbackQueryToMessage(callbackQuery))
        }
    }
}

/*
 *  TO USER
 */
export class InlineButton {
    constructor(text, callbackData) {
        this.text = text
        this.callbackData = callbackData
    }
}

// send or edit message from bot to user
export class MessageToUser {
    // INFO: userId, chatId, text - reqired params
    constructor(userId,
        chatId,
        text = '',
        inlineButtons = undefined) {
        // TODO: add checks userId, chatId, text isNotBlank()
        this.userId = userId
        this.chatId = chatId
        this.text = text
        this.inlineButtons = inlineButtons
    }
}
export class MessageToUserEdit extends MessageToUser {
    // TODO: rename messangerMessageIdToEdit to messageIdToEdit
    constructor(messangerMessageIdToEdit, chatId, text, inlineButtons) {
        // TODO: messangerMessageIdToEdit check isNonBlank
        super('userId_not_needed', chatId, text, inlineButtons)
        this.messangerMessageIdToEdit = messangerMessageIdToEdit
    }
}