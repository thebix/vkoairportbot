// in memory sotrage.

import { Observable } from 'rxjs'

class Storage {
    constructor() {
        this.storage = {}
        // TODO: load saved storage from fs
    }
    getItem(id, field) {
        if (!this.storage[id] || !this.storage[id][field])
            return null
        // TODO: make observable
        return this.storage[id]
    }
    updateItem(id, fieldName, item) {
        // TODO: Should be extended with save/load from filesystem to save state on bot restart
        // TODO: rollback changes to fs storage to previous values on error
        const field = fieldName || '0'
        if (!this.storage[id])
            this.storage[id] = {}
        this.storage[id][field] = item
        return Observable.of(true)
    }
    // itemsArray = [{fieldName, item}]
    updateItems(id, itemsArray = []) {
        if (!this.storage[id])
            this.storage[id] = {}
        // TODO: Should be extended with save/load from filesystem to save state on bot restart
        // TODO: rollback changes to fs storage to previous values on error
        itemsArray.forEach(itemToSave => {
            const { fieldName, item } = itemToSave
            const field = fieldName || '0'
            this.storage[id][field] = item
        })

        return Observable.of(true)
    }
    removeItem(id, fieldName) {
        const field = fieldName || '0'
        if (this.storage[id]) {
            // TODO: Should be extended with save/load from filesystem to save state on bot restart
            delete this.storage[id][field]
        }
        return Observable.of(true)
    }
}

const storage = new Storage()

export default storage
