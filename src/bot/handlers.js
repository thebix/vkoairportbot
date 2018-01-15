/*
 * INFO:
 *      - every handler should return Observable.from([BotMessage])
 *
 * TODO:
 *      - ?remove lastCommand functionality and save to storage?
*/

import { Observable } from 'rxjs/Observable'
import { BotMessage, InlineButton, BotMessageEdit, ReplyKeyboard, ReplyKeyboardButton } from './message'
import commands from './commands'
import storage from '../storage'
import { log, logLevel } from '../logger'
import token from '../token'
import InputParser from './inputParser'
import config from '../config'

const lastCommands = {}
const userFlightsSubscribed = {}

/*
 * ERRORS HANDERS
 */
const errorToUser = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    return [new BotMessage(userId, chatId,
        'При при обработке запроса произошла ошибка. Пожалуйста, начните заново')]
}

const botIsInDevelopmentToUser = (userId, chatId) => {
    log(`handlers.botIsInDevelopmentToUser: userId="${userId}" is not in token.developers array.`, logLevel.ERROR)
    return Observable.from([new BotMessage(userId, chatId,
        `В данный момент бот находится в режиме разработки. \nВаш идентификатор в мессенджере - "${userId}". Сообщите свой идентификатор по контактам в описании бота, чтобы Вас добавили в группу разработчиков`)])
}

/*
 * COMMON METHODS
 */
export const dateTimeString = (date = new Date()) => new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Moscow'
}).format(date)

const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)
const getFlightDetailsText = flight =>
    `${flight.flightNumber}\n${flight.departureCity}-${flight.destinationCity}\nВремя регистрации: ${dateTimeString(flight.registartionTime)}\nВремя посадки: ${dateTimeString(flight.boardingTime)}\nВремя вылета: ${dateTimeString(flight.depatureTime)}\nГейт: ${flight.gate}`
const flightsInlineButtonsList = (flights = []) =>
    flights && Array.isArray(flights)
        ? flights
            .map(flight => new InlineButton(`${flight.flightNumber} в ${flight.destinationCity}\nвылет: ${dateTimeString(flight.depatureTime)}`, {
                flightId: flight.id,
                cmd: commands.FLIGHT_SEARCH_SELECT
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
                const buttonToggleSubscriptionText = isUserAlreadySubscribed
                    ? `Отписаться от рейса ${flight.flightNumber}`
                    : `Подписаться на рейс ${flight.flightNumber}`
                const buttonToggleSubscriptionCmd = isUserAlreadySubscribed ? commands.FLIGHT_UNSUBSCRIBE : commands.FLIGHT_SUBSCRIBE
                const buttonToggleSubscription = new InlineButton(buttonToggleSubscriptionText, {
                    flightId: flight.id,
                    cmd: buttonToggleSubscriptionCmd
                })
                const text = isUserAlreadySubscribed
                    ? `Вы подписаны на рейс\n${getFlightDetailsText(flight)}`
                    : `Найденный рейс\n${getFlightDetailsText(flight)}`
                if (messageToEditId)
                    return [new BotMessageEdit(messageToEditId, chatId, text, [buttonToggleSubscription])]
                return [new BotMessage(userId, chatId, text,
                    [buttonToggleSubscription])]
            }
            log(`handlers.sendFoundFlightToUser: update user last command in storage error. ChatId: ${chatId}, userId: ${userId}, command: ${command}, flightId: ${flight.id}`, logLevel.ERROR)
            return errorToUser(userId, chatId)
        })
}

/*
 * HANDLERS
 */
/*
 * USER MESSAGE HELPERS
 */
const start = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.START
    // predefined reply buttons
    const keyboard = new ReplyKeyboard([
        new ReplyKeyboardButton('/Поиск рейса'),
        new ReplyKeyboardButton('/Мои полёты'),
        new ReplyKeyboardButton('/Помощь')], true, true)
    // TODO: save the last command in storage or remove lastCommand functionality
    return Observable.from([new BotMessage(userId, chatId,
        'Вас приветствует VkoAirportBot!\nЗдесь можно посмотреть информацию о предстоящем рейсе и подписаться на оповещения о нем.\nДля свазяи с администрацией бота используйте контакты из описания', undefined, keyboard)])
}

const help = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.HELP
    // TODO: save the last command in storage or remove lastCommand functionality
    return Observable.from([new BotMessage(userId, chatId,
        'Помощь\nЗдесь Вы можете узнать актуальную информацию о предстоящем полете и подписаться на оповещения о нем.')])
}

const flightSearchStart = (userId, chatId) =>
    updateLastCommand(userId, chatId, commands.FLIGHT_SEARCH_START)
        .mergeMap(updateResult => {
            if (updateResult === true) {
                lastCommands[`${userId}${chatId}`] = commands.FLIGHT_SEARCH_START
                return [new BotMessage(userId, chatId,
                    'Введите номер рейса или город назначения')]
            }
            log(`handlers.flightSearchStart: update last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
            return errorToUser(userId, chatId)
        })

const flightSearchShowListByInput = (userId, chatId, text) => {
    log(`handlers.flightSearchShowListByInput(userId=${userId}, chatId=${chatId}, text='${text}')`, logLevel.DEBUG)
    // check by flight number
    const flightNumber = text.replace(/\s/g, '').toLowerCase()
    const flightsByNumber = token.flights.filter(item => item.flightNumber.replace(/\s/g, '').toLowerCase().indexOf(flightNumber) !== -1)
    let flight
    if (flightsByNumber && flightsByNumber.length > 0)
        // TODO: show list if flights more that one
        flight = flightsByNumber[0]
    else {
        // check by city
        const cityDestination = text.trim().toLowerCase()
        const flightsByCity = token.flights.filter(item => item.destinationCity.toLowerCase() === cityDestination)
        const command = commands.FLIGHT_SEARCH_SHOW_LIST_BY_INPUT
        if (flightsByCity && flightsByCity.length > 0)
            return updateLastCommand(userId, chatId, command)
                .mergeMap(updateStorageResult => {
                    if (updateStorageResult) {
                        lastCommands[`${userId}${chatId}`] = command
                        // INFO: further improvement - split to several messages if flights length is too large
                        const flights = flightsInlineButtonsList(flightsByCity)
                        return [new BotMessage(userId, chatId, 'Найдены рейсы, выберите Ваш', flights)]
                    }
                    log(`handlers.flightSearchShowListByInput: update user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                    return errorToUser(userId, chatId)
                })
    }
    if (flight) {
        return sendFoundFlightToUser(userId, chatId, commands.FLIGHT_SEARCH_SELECT, flight)
    }
    lastCommands[`${userId}${chatId}`] = commands.FLIGHT_SEARCH_START
    return [new BotMessage(userId, chatId,
        'По заданным критериям рейс не найден. Если вводили город, попробуйте ввести рейс и наоборот')]
}

const userFlights = (userId, chatId) => {
    log(`handlers.userFlights(userId=${userId}, chatId=${chatId})`, logLevel.DEBUG)
    // TODO: add lastCommand save and save to storage or remove lastCommand functionality
    const userFlighsArray = userFlightsSubscribed[`${userId}${chatId}`]
        ? Object.keys(userFlightsSubscribed[`${userId}${chatId}`]).map((key) => userFlightsSubscribed[`${userId}${chatId}`][key])
        : []
    const flights = flightsInlineButtonsList(userFlighsArray)
    return [new BotMessage(userId, chatId,
        flights.length > 0 ? 'Ваши полёты' : 'У Вас нет подписок на полёты',
        flights.length > 0 ? flights : [new InlineButton('Поиск рейса', { cmd: commands.FLIGHT_SEARCH_START })])]
}

/*
 * USER ACTION HELPERS
 */
const flightSearchSelect = (userId, chatId, data, editMessageId) => {
    log(`handlers.flightSearchSelect(userId=${userId}, chatId=${chatId}, editMessageId=${editMessageId}, data='${JSON.stringify(data)}')`, logLevel.DEBUG)
    const { flightId } = data

    // check by flight id
    const flightsById = token.flights.filter(item => item.id === flightId)
    if (flightsById && flightsById.length > 0) {
        return sendFoundFlightToUser(userId, chatId, commands.FLIGHT_SEARCH_SELECT, flightsById[0], editMessageId)
    }
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    log(`handlers.flightSearchSelect: user can't select flight from list. UserId=${userId}, chatId=${chatId}, flightId=${flightId}`, logLevel.ERROR)
    return [new BotMessage(userId, chatId,
        'При выборе рейса возникла проблема. Пожалуйста, начните с начала')]
}

const flightSubscriptionToggle = (userId, chatId, data, buttonMessageId) => {
    log(`handlers.flightSubscriptionToggle(userId=${userId}, chatId=${chatId}, data='${JSON.stringify(data)}'), buttonMessageId=${buttonMessageId}`, logLevel.DEBUG)
    const { flightId, cmd: buttonCmd } = data

    // check by flight id
    const flightsById = token.flights.filter(item => item.id === flightId)
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
                    if (isUserAlreadySubscribed && buttonCmd === commands.FLIGHT_UNSUBSCRIBE) {
                        delete currentUserFlightsSubscribed[flight.id]
                        userNotificationText = `Вы отписались от рейса ${flight.flightNumber}`
                    } else if (!isUserAlreadySubscribed && buttonCmd === commands.FLIGHT_SUBSCRIBE) {
                        currentUserFlightsSubscribed[flight.id] = flight
                        userNotificationText = `Вы подписались на рейс ${flight.flightNumber}`
                    } else
                        userNotificationText = isUserAlreadySubscribed ? `Вы уже подписаны на рейс ${flight.flightNumber}` : `Вы уже отписаны от рейса ${flight.flightNumber}`

                    lastCommands[`${userId}${chatId}`] = buttonCmd
                    userFlightsSubscribed[`${userId}${chatId}`] = currentUserFlightsSubscribed

                    const buttonToggleSubscriptionText = buttonCmd === commands.FLIGHT_SUBSCRIBE
                        ? `Отписаться от рейса ${flight.flightNumber}`
                        : `Подписаться на рейс ${flight.flightNumber}`
                    const buttonToggleSubscriptionCmd = buttonCmd === commands.FLIGHT_SUBSCRIBE
                        ? commands.FLIGHT_UNSUBSCRIBE
                        : commands.FLIGHT_SUBSCRIBE
                    const buttonToggleSubscription = new InlineButton(buttonToggleSubscriptionText,
                        { flightId: flight.id, cmd: buttonToggleSubscriptionCmd })
                    const text = buttonCmd === commands.FLIGHT_SUBSCRIBE
                        ? `Вы подписаны на рейс\n${getFlightDetailsText(flight)}`
                        : `Найденный рейс\n${getFlightDetailsText(flight)}`
                    if (buttonMessageId)
                        return [
                            new BotMessageEdit(buttonMessageId, chatId, text, [buttonToggleSubscription]),
                            new BotMessage(userId, chatId, userNotificationText)]
                    return [new BotMessage(userId, chatId, text,
                        [buttonToggleSubscription])]
                }
                log(`handlers.flightSubscriptionToggle: update userFlightsSubscribed or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return errorToUser(userId, chatId)
            })
    }
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    log(`handlers.flightSubscriptionToggle: user can't toggle subscription to concrete flight which was found previously. UserId=${userId}, chatId=${chatId}, flightId=${flightId}`, logLevel.ERROR)
    return [new BotMessage(userId, chatId,
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
    else if (InputParser.isFlightSearchStart(text)) {
        messagesToUser = flightSearchStart(from, chatId)
    } else if (InputParser.isFlightSearchShowListByInput(lastCommands[`${from}${chatId}`])) {
        messagesToUser = flightSearchShowListByInput(from, chatId, text)
    }

    if (!messagesToUser) {
        messagesToUser = help(from, chatId)
    }

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export const mapUserActionToHandler = userAction => {
    const { message, data = {} } = userAction
    const { from, chat, id } = message
    const chatId = chat ? chat.id : from
    const callbackCommand = data.cmd || undefined
    let messagesToUser
    if (InputParser.isFlightSearchStart(undefined, callbackCommand)) {
        messagesToUser = flightSearchStart(from, chatId)
    } else if (InputParser.isFlightSubscriptionToggle(callbackCommand)) {
        messagesToUser = flightSubscriptionToggle(from, chatId, data, id)
    } else if (InputParser.isFlightSearchSelect(callbackCommand)) {
        messagesToUser = flightSearchSelect(from, chatId, data, id)
    } else {
        log(`handlers.mapUserActionToHandler: can't find handler for user action callback query. userId=${from}, chatId=${chatId}, data=${JSON.stringify(data)}`, logLevel.ERROR)
        messagesToUser = errorToUser(from, chatId)
    }

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export default mapMessageToHandler
