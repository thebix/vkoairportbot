import { Observable } from 'rxjs/Observable'
import { MessageToUser } from './message'
import commands from './commands'
import storage from '../storage'
import { log, logLevel } from '../logger'
import token from '../token'
import InputParser from './inputParser'
import config from '../config'

const lastCommands = {}
const userFlights = {}

const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)

const help = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.HELP
    //TODO: save the last command in storage
    return Observable.of(new MessageToUser(userId, chatId,
        'Помощь\nЗдесь вы можете узнать актуальное расписание вылета самолетов'))
}

const flightCheckStart = (userId, chatId) =>
    updateLastCommand(userId, chatId, commands.FLIGHT_CHECK_START)
        .mergeMap(updateResult => {
            if (updateResult === true) {
                lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_START
                return Observable.of(new MessageToUser(userId, chatId,
                    'Введите номер рейса или город назначения'))
            }
            log(`handlers: update last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
            return errorToUser(userId, chatId)
        })

const flightCheckFlightOrCityEntered = (userId, chatId, text) => {
    // check by flight number
    const flightId = text.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.toLowerCase() === flightId)
    let flight
    if (flightsById && flightsById.length > 0)
        flight = flightsById[0]
    else {
        // check by city
        // TODO: add logic for user selection from all availavble flights
        const cityDestination = text.trim().toLowerCase()
        const flightsByCity = token.flights.filter(item => item.destination.toLowerCase() === cityDestination)
        if (flightsByCity && flightsByCity.length > 0)
            flight = flightsByCity[0]
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
                    return Observable.of(new MessageToUser(userId, chatId, 'Ваш рейс найден'))
                }
                log(`handlers: update userFlights or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return errorToUser(userId, chatId)
            })
    }
    lastCommands[`${userId}${chatId}`] = commands.FLIGHT_CHECK_START
    return Observable.of(new MessageToUser(userId, chatId,
        'По заданным критериям рейс не найден. Если вводили город, попробуйте ввести рейс и наоборот'))
}

const errorToUser = (userId, chatId) => {
    lastCommands[`${userId}${chatId}`] = commands.ERROR
    Observable.of(new MessageToUser(userId, chatId,
        'При при обработке запроса произошла ошибка. Пожалуйста, начните заново'))
}

const mapMessageToHandler = message => {
    const { text, from, chat } = message
    const chatId = chat ? chat.id : from
    if (!config.isProduction && !InputParser.isDeveloper(from)) {
        log(`vkoBot.mapMessageToHandler: userId="${from}" is not in token.developers array.`, logLevel.ERROR)
        return Observable.of(new MessageToUser(from, chatId,
            `В данный момент бот находится в режиме разработки. \nВаш идентификатор в мессенджере - "${from}". Обратитесь по контактам в боте, чтобы Вас добавили в группу разработчиков`))
        return Observable.empty()
    }
    if (InputParser.isFlightCheckStart(text)) {
        return flightCheckStart(from, chatId, text)
    }
    if (InputParser.isFlightCheckFlightOrCityEntered(text, lastCommands[`${from}${chatId}`])) {
        return flightCheckFlightOrCityEntered(from, chatId, text)
    }
    return help(from, chatId)
}

export default mapMessageToHandler
