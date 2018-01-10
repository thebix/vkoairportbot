import token from '../token'

export default class InputParser {
    // TODO: move to another class
    static isDeveloper(id) {
        return token.developers
            && token.developers.length > 0
            && token.developers.some(x => x === id)
    }
    static isAskingForEcho() {
        return true
    }
    static isAskingForHelp(text) {
        const pattern = /help|помощь/i
        return text.match(pattern)
    }
    static isAskingForStart(text) {
        const pattern = /start/i
        return text.match(pattern)
    }
    static isAskingForInitToken(text) {
        const pattern = /token/i
        return text.match(pattern)
    }
}
