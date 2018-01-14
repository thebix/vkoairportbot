import token from '../token'
import commands from './commands'

export default class InputParser {
    // INFO: ?move to another class?
    static isDeveloper(id) {
        return token.developers
            && token.developers.length > 0
            && token.developers.some(x => x === id)
    }
    static isAskingForEcho() {
        return true
    }
    static isAskingForStart(text) {
        const pattern = /^\/start|старт/i
        return text.match(pattern)
    }
    static isAskingForHelp(text) {
        const pattern = /^\/help|помощь/i
        return text.match(pattern)
    }
    static isAskingForStart(text) {
        const pattern = /^\/start/i
        return text.match(pattern)
    }
    static isAskingForInitToken(text) {
        const pattern = /^\/token/i
        return text.match(pattern)
    }
    static isFlightCheckStart(text) {
        // TODO: remove |йцу|qwe
        const pattern = /^\/flight|рейс|йцу|qwe/i
        return text.match(pattern)
    }
    // TODO: 'text' not needed, remove
    static isFlightCheckFlightOrCityEntered(text, prevCommand) {
        return prevCommand === commands.FLIGHT_CHECK_START
    }

    /*
     * CallbackQueries
     */
    static isFlightCheckFoundFromMany(command) {
        return command === commands.FLIGHT_CHECK_FOUND_FROM_MANY
            || command === commands.FLIGHT_CHECK_FOUND_BY_FLIGHT
    }
    static isFlightSubscriptionToggle(command) {
        return command === commands.FLIGHT_SUBSCRIBED
            || command === commands.FLIGHT_UNSUBSCRIBED
    }
}
