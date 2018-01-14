// TODO: should be renamed to states.js
export default {
    ERROR: -1,
    START: 0,
    HELP: 1,
    ECHO: 2,
    TOKEN: 3,

    FLIGHT_CHECK_START: 4,
    FLIGHT_CHECK_FLIGHT_OR_CITY_ENTERED: 5,
    FLIGHT_CHECK_FOUND_BY_FLIGHT: 6,
    FLIGHT_CHECK_FOUND_MANY_BY_CITY: 7,
    // TODO: rename to FLIGHT_SELECTED_FROM_MANY
    FLIGHT_CHECK_FOUND_FROM_MANY: 8,
    FLIGHT_SUBSCRIBED: 9,
    FLIGHT_UNSUBSCRIBED: 10,

    USER_FLIGHTS: 11
}
