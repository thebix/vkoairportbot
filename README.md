# Vko airport bot

## prepare env
```
npm install
vi ./src/token.js
```
### token.js file body:
``` javascript
export default {
    botToken: {
        dev: '//TODO: go to @botfather',
        prod: '//TODO: go to @botfather'
    },
    developers: [
        //TODO: paste your telegram id here
    ],
    
    //init tokens data block
    initData: {
        ['some-init-token']: {}
    }
}
```
## prod
```
npm install
npm build
npm run serve
```

## start bot
```
/start
/token some-init-token
```