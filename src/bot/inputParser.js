import token from '../token'
import commands from './commands'
import config from '../config'

export default class InputParser {
    static isDeveloper(id) {
        return token.developers
            && token.developers.length > 0
            && token.developers.some(x => x === id)
    }
    static isAskingForEcho() {
        return true
    }
    static isStart(text) {
        const pattern = /^\/start|старт/i
        return text.match(pattern)
    }
    static isHelp(text) {
        const pattern = /^\/help|помощь/i
        return text.match(pattern)
    }
    static isStart(text) {
        const pattern = /^\/start/i
        return text.match(pattern)
    }
    static isAskingForInitToken(text) {
        const pattern = /^\/token/i
        return text.match(pattern)
    }
    static isFlightSearchStart(text = '', callbackCommand = undefined) {
        const pattern = config.isProduction ?
            /^\/flight|рейс|поиск рейса/i
            : /^\/flight|рейс|поиск рейса|йцу|qwe/i

        return callbackCommand === commands.FLIGHT_SEARCH_START
            || (text || '').match(pattern)
    }
    static isFlightSearchShowListByInput(prevCommand) {
        return prevCommand === commands.FLIGHT_SEARCH_START
    }

    /*
     * CallbackQueries
     */
    static isFlightSearchSelect(callbackCommand) {
        return callbackCommand === commands.FLIGHT_SEARCH_SELECT
    }
    static isFlightSubscriptionToggle(callbackCommand) {
        return callbackCommand === commands.FLIGHT_SUBSCRIBE
            || callbackCommand === commands.FLIGHT_UNSUBSCRIBE
    }
    static isUserFlights(text) {
        const pattern = /^\/My flights|Мои полёты/i
        return text.match(pattern)
    }
}
