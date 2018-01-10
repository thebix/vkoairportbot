import { Observable } from 'rxjs/Observable'
import { MessageToUser } from './message'
import commands from './commands'
import storage from '../storage'
import { log, logLevel } from '../logger'
import token from '../token'

const userFlights = {}

const updateLastCommand = (userId, chatId, command) => storage.updateItem(`${userId}${chatId}`, 'lastCommand', command)

const help = (userId, chatId) => Observable.of(new MessageToUser(userId, chatId,
    'Помощь\nЗдесь вы можете узнать актуальное расписание вылета самолетов', commands.HELP))

export const flightCheckStart = (userId, chatId) =>
    updateLastCommand(userId, chatId, commands.FLIGHT_CHECK_START)
        .mergeMap(updateResult => {
            if (updateResult === true)
                return Observable.of(new MessageToUser(userId, chatId,
                    'Введите номер рейса или город назначения', commands.FLIGHT_CHECK_START))
            log(`handlers: update last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
            return Observable.of(new MessageToUser(userId, chatId,
                'При при обработке запроса произошла ошибка. Пожалуйста, начните заново', commands.ERROR))
        })

export const flightCheckFlightOrCityEntered = (userId, chatId, text) => {
    // check by flight number
    const flightId = text.replace(/\s/g, '').toLowerCase()
    const flightsById = token.flights.filter(item => item.id.toLowerCase() === flightId)
    let flight
    if (flightsById && flightsById.length > 0)
        flight = flightsById[0]
    else {
        // check by city
        // TODO: add logic for user selection from all availavble flights
        const cityDestination = text.trim()
        const flightsByCity = token.flights.filter(item => item.destination.toLowerCase() === cityDestination)
        if (flightsByCity && flightsByCity.length > 0)
            flight = flightsById[0]
    }
    if (flight) {
        const currentUserFlights = userFlights[`${userId}${chatId}`] || {}
        currentUserFlights[flight.id] = flight
        userFlights[`${userId}${chatId}`] = currentUserFlights

        return storage.updateItems(`${userId}${chatId}`, [
            { fieldName: 'lastCommand', item: commands.FLIGHT_CHECK_FLIGHT_FOUND },
            { fieldName: 'userFlights', item: currentUserFlights }])
            .mergeMap(updateStorageResult => {
                if (updateStorageResult) {
                    return Observable.of(new MessageToUser(userId, chatId, 'Ваш рейс найден', commands.FLIGHT_CHECK_FLIGHT_FOUND))
                }
                log(`handlers: update userFlights or user last command in storage error. ChatId: ${chatId}, userId: ${userId}`, logLevel.ERROR)
                return Observable.of(new MessageToUser(userId, chatId,
                    'При при обработке запроса произошла ошибка. Пожалуйста, начните заново', commands.ERROR))
            })
    }
    return Observable.of(new MessageToUser(userId, chatId,
        'По заданным критериям рейс не найден. Если вводили город, попробуйте ввести рейс и наоборот', commands.FLIGHT_CHECK_START))
}

export const errorToUser = (userId, chatId) => Observable.of(new MessageToUser(userId, chatId,
    'При при обработке запроса произошла ошибка. Пожалуйста, начните заново.', commands.ERROR))

export default help
