const isProduction = process.env.NODE_ENV === 'production'

export default {
    isProduction,
    log: isProduction ? 'INFO' : 'DEBUG',
    dirStorage: `${__dirname}/storage/`
}
