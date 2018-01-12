/*
 *  INFO:
 *      - every handler should return Observable.from([MessageToUser])
*/

import { Observable } from 'rxjs/Observable'
import { MessageToUser, InlineButton, MessageToUserEdit } from './message'
import commands from './commands'
import storage from '../storage'
// INFO: dateTimeString should be used from special datetime class
import { log, logLevel, dateTimeString } from '../logger'
import token from '../token'
import InputParser from './inputParser'
import config from '../config'

const lastCommands = {}
const userFlights = {}

/************
 * COMMON METHODS
 ************/
const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)
const getFlightDetailsText = (flight) => `${flight.id}\n${flight.departureCity}-${flight.destinationCity}\nВремя посадки: ${dateTimeString(flight.boardingTime)}\nВремя вылета: ${dateTimeString(flight.depatureTime)}\nГейт: ${flight.gate}`
const sendFoundFlightToUser = (userId, chatId, command, flight, messageToEditId) => {
    const currentUserFlights = Object.assign({}, userFlights[`${userId}${chatId}`])
    currentUserFlights[flight.id] = flight
    return updateLastCommand(userId, chatId, command)
        .mergeMap(updateStorageResult => {
            if (updateStorageResult) {
                lastCommands[`${userId}${chatId}`] = command
                // TODO: if user has already subscribed to flight - show it as subscribed (look at the method flightSubscribed())
                // TODO: change flight.id to flight.flight
                const buttonSubscribeToFlight = new InlineButton(`Подписаться на рейс ${flight.id}`, { flightId: flight.id, cmd: commands.FLIGHT_SUBSCRIBED })
                const text = `Найденный рейс\n${getFlightDetailsText(flight)}`
                if (messageToEditId)
                    return [new MessageToUserEdit(messageToEditId, chatId, text, [buttonSubscribeToFlight])]
                return [new MessageToUser(userId, chatId, text,
                    [buttonSubscribeToFlight])]
            }
            log(`handlers: update user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
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
    log(`vkoBot.mapMessageToHandler: userId="${userId}" is not in token.developers array.`, logLevel.ERROR)
    return Observable.from([new MessageToUser(userId, chatId,
        `В данный момент бот находится в режиме разработки. \nВаш идентификатор в мессенджере - "${userId}". Сообщите свой идентификатор по контактам в описании бота, чтобы Вас добавили в группу разработчиков`)])
}

/*
 * USER COMMAND HELPERS
 */
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
            log(`handlers: update last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
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
                        const flights = flightsByCity
                            .map(flight => new InlineButton(`${flight.id}, гейт: ${flight.gate}`, {
                                flightId: flight.id,
                                cmd: commands.FLIGHT_CHECK_FOUND_FROM_MANY
                            }))
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
const flightSubscribed = (userId, chatId, data, subscribeButtomMessageId) => {
    log(`handlers.flightSubscribed(userId=${userId}, chatId=${chatId}, data='${JSON.stringify(data)}'), subscribeButtomMessageId=${subscribeButtomMessageId}`, logLevel.DEBUG)
    let { flightId = '' } = data

    // check by flight id
    flightId = flightId.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.replace(/\s/g, '').toLowerCase() === flightId)

    if (flightsById && flightsById.length > 0) {
        // return sendFoundFlightToUser(userId, chatId, commands.FLIGHT_CHECK_FOUND_FROM_MANY, flightsById[0], editMessageId)
        const flight = flightsById[0]
        const currentUserFlights = Object.assign({}, userFlights[`${userId}${chatId}`])
        currentUserFlights[flight.id] = flight
        const command = commands.FLIGHT_SUBSCRIBED
        return storage.updateItems(`${userId}${chatId}`, [
            { fieldName: 'lastCommand', item: command },
            { fieldName: 'userFlights', item: currentUserFlights }])
            .mergeMap(updateStorageResult => {
                if (updateStorageResult) {
                    lastCommands[`${userId}${chatId}`] = command
                    userFlights[`${userId}${chatId}`] = currentUserFlights

                    const buttonUnsubscribeFlight = new InlineButton(`Отписаться от рейса ${flight.id}`, { flightId: flight.id, cmd: commands.FLIGHT_UNSUBSCRIBED })
                    const text = `Вы подписаны на рейс\n${getFlightDetailsText(flight)}`
                    if (subscribeButtomMessageId)
                        return [new MessageToUserEdit(subscribeButtomMessageId, chatId, text, [buttonUnsubscribeFlight])]
                    return [new MessageToUser(userId, chatId, text,
                        [buttonUnsubscribeFlight])]
                }
                log(`handlers: update userFlights or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return errorToUser(userId, chatId)
            })
    }
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    log(`handlers.flightSubscribed: user can't subscribe to concrete flight which was found previously. UserId=${userId}, chatId=${chatId}, flightId=${flightId}`, logLevel.ERROR)
    return [new MessageToUser(userId, chatId,
        'При подписке на рейс возникла проблема. Пожалуйста, начните с начала')]
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
    } else if (InputParser.isFlightCheckStart(text)) {
        messagesToUser = flightCheckStart(from, chatId, text)
    } else if (InputParser.isFlightCheckFlightOrCityEntered(text, lastCommands[`${from}${chatId}`])) {
        messagesToUser = flightCheckFlightOrCityEntered(from, chatId, text)
    } else
        messagesToUser = help(from, chatId)

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export const mapCallbackQueryToHandler = callbackQuery => {
    const { message, data = {} } = callbackQuery
    const { from, chat, id } = message
    const chatId = chat ? chat.id : from
    // const lastCommand = lastCommands[`${from}${chatId}`]
    const callbackCommand = data.cmd || undefined
    let messagesToUser
    if (InputParser.isFlightSubscribed(callbackCommand)) {
        messagesToUser = flightSubscribed(from, chatId, data, id)
    } else if (InputParser.isFlightCheckFoundFromMany(callbackCommand)) {
        messagesToUser = flightCheckFoundFromMany(from, chatId, data, id)
    } else {
        log(`handlers.mapCallbackQueryToHandler: can't find handler for user action callback query. userId=${userId}, chatId=${chatId}, data=${JSON.stringify(data)}`, logLevel.ERROR)
        messagesToUser = errorToUser(from, chatId)
    }

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export default mapMessageToHandler