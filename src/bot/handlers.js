/*
    INFO:
        - every handler should return Observable.from([MessageToUser])
*/

import { Observable } from 'rxjs/Observable'
import { MessageToUser, InlineButton } from './message'
import commands from './commands'
import storage from '../storage'
import { log, logLevel } from '../logger'
import token from '../token'
import InputParser from './inputParser'
import config from '../config'

const lastCommands = {}
const userFlights = {}

const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)

const errorToUser = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    return [new MessageToUser(userId, chatId,
        'При при обработке запроса произошла ошибка. Пожалуйста, начните заново')]
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
        const flightsByCity = token.flights.filter(item => item.destination.toLowerCase() === cityDestination)
        if (flightsByCity && flightsByCity.length > 0)
            return updateLastCommand(userId, chatId, commands.FLIGHT_CHECK_FOUND_BY_CITY)
                .mergeMap(updateStorageResult => {
                    if (updateStorageResult) {
                        lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_FOUND_BY_CITY
                        const flights = flightsByCity
                            .map(item => `№ ${item.id}, гейт: ${item.gate}`)
                            .join('\n')
                        // TODO: add logic for user selection from all availavble flights
                        return [new MessageToUser(userId, chatId, 'Найдены рейсы:'), new MessageToUser(userId, chatId, flights)]
                    }
                    log(`handlers: update userFlights or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                    return errorToUser(userId, chatId)
                })
    }
    if (flight) {
        const currentUserFlights = Object.assign({}, userFlights[`${userId}${chatId}`])
        currentUserFlights[flight.id] = flight

        return storage.updateItems(`${userId}${chatId}`, [
            { fieldName: 'lastCommand', item: commands.FLIGHT_CHECK_FLIGHT_FOUND },
            { fieldName: 'userFlights', item: currentUserFlights }])
            .mergeMap(updateStorageResult => {
                if (updateStorageResult) {
                    lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_FLIGHT_FOUND
                    userFlights[`${userId}${chatId}`] = currentUserFlights
                    return [new MessageToUser(userId, chatId, `Ваш рейс найден\n№ ${flight.id}, гейт: ${flight.gate}`)]
                }
                log(`handlers: update userFlights or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return errorToUser(userId, chatId)
            })
    }
    lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_START
    return [new MessageToUser(userId, chatId,
        'По заданным критериям рейс не найден. Если вводили город, попробуйте ввести рейс и наоборот')]
}

const mapMessageToHandler = message => {
    const { text, from, chat } = message
    const chatId = chat ? chat.id : from

    let messagesToUser
    if (!config.isProduction && !InputParser.isDeveloper(from)) {
        log(`vkoBot.mapMessageToHandler: userId="${from}" is not in token.developers array.`, logLevel.ERROR)
        return Observable.from([new MessageToUser(from, chatId,
            `В данный момент бот находится в режиме разработки. \nВаш идентификатор в мессенджере - "${from}". Сообщите свой идентификатор по контактам в описании бота, чтобы Вас добавили в группу разработчиков`)])
    }
    if (InputParser.isFlightCheckStart(text)) {
        messagesToUser = flightCheckStart(from, chatId, text)
    } else if (InputParser.isFlightCheckFlightOrCityEntered(text, lastCommands[`${from}${chatId}`])) {
        messagesToUser = flightCheckFlightOrCityEntered(from, chatId, text)
    } else if (!messagesToUser)
        messagesToUser = help(from, chatId)

    return Observable.from(messagesToUser)
        .concatMap(msgToUser => Observable.of(msgToUser).delay(10))
}

export default mapMessageToHandler
