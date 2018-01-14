/*
 * INFO:
 *      - every handler should return Observable.from([MessageToUser])
 *
 * TODO:
 *      - ?remove lastCommand functionality and save to storage?
*/

import { Observable } from 'rxjs/Observable'
import { MessageToUser, InlineButton, MessageToUserEdit, ReplyKeyboard, ReplyKeyboardButton } from './message'
import commands from './commands'
import storage from '../storage'
import { log, logLevel } from '../logger'
import token from '../token'
import InputParser from './inputParser'
import config from '../config'

const lastCommands = {}
const userFlightsSubscribed = {}

/************
 * COMMON METHODS
 ************/
export const dateTimeString = (date = new Date()) => {
    var options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Moscow'
    }
    return new Intl.DateTimeFormat('ru-RU', options).format(date)
}

const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)
const getFlightDetailsText = (flight) => `${flight.id}\n${flight.departureCity}-${flight.destinationCity}\nВремя регистрации: ${dateTimeString(flight.registartionTime)}\nВремя посадки: ${dateTimeString(flight.boardingTime)}\nВремя вылета: ${dateTimeString(flight.depatureTime)}\nГейт: ${flight.gate}`
const flightsInlineButtonsList = (flights = []) => flights && Array.isArray(flights)
    ? flights
        .map(flight => new InlineButton(`${flight.id} в ${flight.destinationCity}\nвылет: ${dateTimeString(flight.depatureTime)}`, {
            flightId: flight.id,
            cmd: commands.FLIGHT_CHECK_FOUND_FROM_MANY
        }))
    : []

const sendFoundFlightToUser = (userId, chatId, command, flight, messageToEditId) => {
    const currentUserFlightsSubscribed = Object.assign({}, userFlightsSubscribed[`${userId}${chatId}`])
    const isUserAlreadySubscribed = !!currentUserFlightsSubscribed[flight.id]
    currentUserFlightsSubscribed[flight.id] = flight
    return updateLastCommand(userId, chatId, command)
        .mergeMap(updateStorageResult => {
            if (updateStorageResult) {
                lastCommands[`${userId}${chatId}`] = command
                const buttonToggleSubscriptionText = isUserAlreadySubscribed ? `Отписаться от рейса ${flight.id}` : `Подписаться на рейс ${flight.id}`
                const buttonToggleSubscriptionCmd = isUserAlreadySubscribed ? commands.FLIGHT_UNSUBSCRIBED : commands.FLIGHT_SUBSCRIBED
                const buttonToggleSubscription = new InlineButton(buttonToggleSubscriptionText, {
                    flightId: flight.id,
                    cmd: buttonToggleSubscriptionCmd
                })
                const text = isUserAlreadySubscribed ? `Вы подписаны на рейс\n${getFlightDetailsText(flight)}` : `Найденный рейс\n${getFlightDetailsText(flight)}`
                // TODO: change flight.id to flight.flight
                if (messageToEditId)
                    return [new MessageToUserEdit(messageToEditId, chatId, text, [buttonToggleSubscription])]
                return [new MessageToUser(userId, chatId, text,
                    [buttonToggleSubscription])]
            }
            log(`handlers.sendFoundFlightToUser: update user last command in storage error. ChatId: ${chatId}, userId: ${userId}, command: ${command}, flightId: ${flight.id}`, logLevel.ERROR)
            return errorToUser(userId, chatId)
        })
}

/************
 * HANDLERS
 ************/
// TODO: rename handlers as InputParsers as commands
/*
 * ERRORS
 */
const errorToUser = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    return [new MessageToUser(userId, chatId,
        'При при обработке запроса произошла ошибка. Пожалуйста, начните заново')]
}

const botIsInDevelopmentToUser = (userId, chatId) => {
    log(`handlers.botIsInDevelopmentToUser: userId="${userId}" is not in token.developers array.`, logLevel.ERROR)
    return Observable.from([new MessageToUser(userId, chatId,
        `В данный момент бот находится в режиме разработки. \nВаш идентификатор в мессенджере - "${userId}". Сообщите свой идентификатор по контактам в описании бота, чтобы Вас добавили в группу разработчиков`)])
}

/*
 * USER COMMAND HELPERS
 */
const start = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.START
    // predefined reply buttons
    const keyboard = new ReplyKeyboard([new ReplyKeyboardButton('/Поиск рейса'), new ReplyKeyboardButton('/Мои полёты'), new ReplyKeyboardButton('/Помощь')], true, true)
    // TODO: save the last command in storage
    return Observable.from([new MessageToUser(userId, chatId,
        'Вас приветствует VkoAirportBot!\nЗдесь можно посмотреть информацию о предстоящем рейсе и подписаться на оповещения о нем.\nДля свазяи с администрацией бота используйте контакты из описания', undefined, keyboard)])
}

const help = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.HELP
    // TODO: save the last command in storage
    return Observable.from([new MessageToUser(userId, chatId,
        'Помощь\nЗдесь вы можете узнать актуальное расписание вылета самолетов')])
}

const flightCheckStart = (userId, chatId) =>
    updateLastCommand(userId, chatId, commands.FLIGHT_CHECK_START)
        .mergeMap(updateResult => {
            if (updateResult === true) {
                lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_START
                return [new MessageToUser(userId, chatId,
                    'Введите номер рейса или город назначения')]
            }
            log(`handlers.flightCheckStart: update last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
            return errorToUser(userId, chatId)
        })

const flightCheckFlightOrCityEntered = (userId, chatId, text) => {
    log(`handlers.flightCheckFlightOrCityEntered(userId=${userId}, chatId=${chatId}, text='${text}')`, logLevel.DEBUG)
    // check by flight number
    const flightId = text.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.replace(/\s/g, '').toLowerCase() === flightId)
    let flight
    // TODO: add flight.flight, change here to flight.flight usage since id shoould be unique but flights repeats every day
    if (flightsById && flightsById.length > 0)
        flight = flightsById[0]
    else {
        // check by city
        const cityDestination = text.trim().toLowerCase()
        const flightsByCity = token.flights.filter(item => item.destinationCity.toLowerCase() === cityDestination)
        const command = commands.FLIGHT_CHECK_FOUND_MANY_BY_CITY
        if (flightsByCity && flightsByCity.length > 0)
            return updateLastCommand(userId, chatId, command)
                .mergeMap(updateStorageResult => {
                    if (updateStorageResult) {
                        lastCommands[`${userId}${chatId}`] = command
                        // TODO: split to several messages if flights length is too lagre
                        const flights = flightsInlineButtonsList(flightsByCity)
                        return [new MessageToUser(userId, chatId, 'Найдены рейсы, выберите Ваш', flights)]
                    }
                    log(`handlers.flightCheckFlightOrCityEntered: update user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                    return errorToUser(userId, chatId)
                })
    }
    if (flight) {
        return sendFoundFlightToUser(userId, chatId, commands.FLIGHT_CHECK_FOUND_BY_FLIGHT, flight)
    }
    lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_START
    return [new MessageToUser(userId, chatId,
        'По заданным критериям рейс не найден. Если вводили город, попробуйте ввести рейс и наоборот')]
}
const userFlights = (userId, chatId) => {
    log(`handlers.userFlights(userId=${userId}, chatId=${chatId})`, logLevel.DEBUG)
    // TODO: add lastCommand save and save to storage or remove lastCommand funcstionality
    const userFlighsArray = userFlightsSubscribed[`${userId}${chatId}`]
        ? Object.keys(userFlightsSubscribed[`${userId}${chatId}`]).map((key) => userFlightsSubscribed[`${userId}${chatId}`][key])
        : []
    const flights = flightsInlineButtonsList(userFlighsArray)
    return [new MessageToUser(userId, chatId,
        flights.length > 0 ? 'Ваши полёты' : 'У Вас нет подписок на полёты',
        flights.length > 0 ? flights : [new InlineButton('Поиск рейса', { cmd: commands.FLIGHT_CHECK_START })])]
}

/*
 * BOT CALLBACK_QUERY HELPERS
 */
const flightCheckFoundFromMany = (userId, chatId, data, editMessageId) => {
    log(`handlers.flightCheckFoundFromMany(userId=${userId}, chatId=${chatId}, editMessageId=${editMessageId}, data='${JSON.stringify(data)}')`, logLevel.DEBUG)
    let { flightId = '' } = data

    // check by flight id
    flightId = flightId.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.replace(/\s/g, '').toLowerCase() === flightId)

    if (flightsById && flightsById.length > 0) {
        return sendFoundFlightToUser(userId, chatId, commands.FLIGHT_CHECK_FOUND_FROM_MANY, flightsById[0], editMessageId)
    }
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    log(`handlers.flightCheckFoundFromMany: user can't select flight from list. UserId=${userId}, chatId=${chatId}, flightId=${flightId}`, logLevel.ERROR)
    return [new MessageToUser(userId, chatId,
        'При выборе рейса возникла проблема. Пожалуйста, начните с начала')]
}
const flightSubscriptionToggle = (userId, chatId, data, buttonMessageId) => {
    log(`handlers.flightSubscriptionToggle(userId=${userId}, chatId=${chatId}, data='${JSON.stringify(data)}'), buttonMessageId=${buttonMessageId}`, logLevel.DEBUG)
    let { flightId = '', cmd: buttonCmd } = data
    // check by flight id
    flightId = flightId.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.replace(/\s/g, '').toLowerCase() === flightId)

    if (flightsById && flightsById.length > 0) {
        const flight = flightsById[0]
        const currentUserFlightsSubscribed = Object.assign({}, userFlightsSubscribed[`${userId}${chatId}`])
        const isUserAlreadySubscribed = !!currentUserFlightsSubscribed[flight.id]
        return storage.updateItems(`${userId}${chatId}`, [
            { fieldName: 'lastCommand', item: buttonCmd },
            { fieldName: 'userFlightsSubscribed', item: currentUserFlightsSubscribed }])
            .mergeMap(updateStorageResult => {
                if (updateStorageResult) {
                    let userNotificationText
                    if (isUserAlreadySubscribed && buttonCmd === commands.FLIGHT_UNSUBSCRIBED) {
                        delete currentUserFlightsSubscribed[flight.id]
                        // TODO: change to flight.flight
                        userNotificationText = `Вы отписались от рейса ${flight.id}`
                    }
                    else if (!isUserAlreadySubscribed && buttonCmd === commands.FLIGHT_SUBSCRIBED) {
                        currentUserFlightsSubscribed[flight.id] = flight
                        // TODO: change to flight.flight
                        userNotificationText = `Вы подписались на рейс ${flight.id}`
                    } else
                        // TODO: change to flight.flight
                        userNotificationText = isUserAlreadySubscribed ? `Вы уже подписаны на рейс ${flight.id}` : `Вы уже отписаны от рейса ${flight.id}`

                    lastCommands[`${userId}${chatId}`] = buttonCmd
                    userFlightsSubscribed[`${userId}${chatId}`] = currentUserFlightsSubscribed

                    const buttonToggleSubscriptionText = buttonCmd === commands.FLIGHT_SUBSCRIBED ? `Отписаться от рейса ${flight.id}` : `Подписаться на рейс ${flight.id}`
                    const buttonToggleSubscriptionCmd = buttonCmd === commands.FLIGHT_SUBSCRIBED ? commands.FLIGHT_UNSUBSCRIBED : commands.FLIGHT_SUBSCRIBED
                    const buttonToggleSubscription = new InlineButton(buttonToggleSubscriptionText, { flightId: flight.id, cmd: buttonToggleSubscriptionCmd })
                    const text = buttonCmd === commands.FLIGHT_SUBSCRIBED ? `Вы подписаны на рейс\n${getFlightDetailsText(flight)}` : `Найденный рейс\n${getFlightDetailsText(flight)}`
                    if (buttonMessageId)
                        return [new MessageToUserEdit(buttonMessageId, chatId, text, [buttonToggleSubscription]),
                        new MessageToUser(userId, chatId, userNotificationText)]
                    return [new MessageToUser(userId, chatId, text,
                        [buttonToggleSubscription])]
                }
                log(`handlers.flightSubscriptionToggle: update userFlightsSubscribed or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return errorToUser(userId, chatId)
            })
    }
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    log(`handlers.flightSubscriptionToggle: user can't toggle subscription to concrete flight which was found previously. UserId=${userId}, chatId=${chatId}, flightId=${flightId}`, logLevel.ERROR)
    return [new MessageToUser(userId, chatId,
        'При изменении подписки на рейс возникла проблема. Пожалуйста, начните с начала')]
}

/*
 * EXPORTS
 */

const mapMessageToHandler = message => {
    const { text, from, chat } = message
    const chatId = chat ? chat.id : from

    let messagesToUser
    if (!config.isProduction && !InputParser.isDeveloper(from)) {
        messagesToUser = botIsInDevelopmentToUser(from, chatId)
    } else if (InputParser.isStart(text)) {
        messagesToUser = start(from, chatId)
    } else if (InputParser.isHelp(text))
        messagesToUser = help(from, chatId)
    else if (InputParser.isUserFlights(text))
        messagesToUser = userFlights(from, chatId)
    else if (InputParser.isFlightCheckStart(text)) {
        messagesToUser = flightCheckStart(from, chatId)
    } else if (InputParser.isFlightCheckFlightOrCityEntered(text, lastCommands[`${from}${chatId}`])) {
        messagesToUser = flightCheckFlightOrCityEntered(from, chatId, text)
    }

    if (!messagesToUser) {
        messagesToUser = help(from, chatId)
    }

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export const mapCallbackQueryToHandler = callbackQuery => {
    const { message, data = {} } = callbackQuery
    const { from, chat, id } = message
    const chatId = chat ? chat.id : from
    const callbackCommand = data.cmd || undefined
    let messagesToUser
    if (InputParser.isFlightCheckStart(undefined, callbackCommand)) {
        messagesToUser = flightCheckStart(from, chatId)
    } else if (InputParser.isFlightSubscriptionToggle(callbackCommand)) {
        messagesToUser = flightSubscriptionToggle(from, chatId, data, id)
    } else if (InputParser.isFlightCheckFoundFromMany(callbackCommand)) {
        messagesToUser = flightCheckFoundFromMany(from, chatId, data, id)
    } else {
        log(`handlers.mapCallbackQueryToHandler: can't find handler for user action callback query. userId=${from}, chatId=${chatId}, data=${JSON.stringify(data)}`, logLevel.ERROR)
        messagesToUser = errorToUser(from, chatId)
    }

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export default mapMessageToHandler