// Source: https://nodejs.org/api/fs.html

import fs from 'fs'
import jsonfile from 'jsonfile'
import Rx from 'rxjs/Rx'

export default class FileSystem {
    readFile(file) {
        return new Promise((resolve, reject) => {
            fs.readFile(file, (err, data) => {
                if (err) return reject(err);
                return resolve(data);
            });
        })
    }
    saveFile(file, data) {
        return new Promise((resolve, reject) => {
            fs.writeFile(file, data, err => {
                if (err) return reject(err);
                return resolve();
            });
        })
    }
    appendFile(file, data) {
        return new Promise((resolve, reject) => {
            fs.appendFile(file, data, err => {
                if (err) return reject(err);
                return resolve();
            });
        })
    }
    readJson(file) {
        return new Promise((resolve, reject) => {
            jsonfile.readFile(file, (err, data) => {
                if (err) return reject(err);
                return resolve(data);
            });
        })
    }
    saveJson(file, data) {
        return new Promise((resolve, reject) => {
            jsonfile.writeFile(file, data, err => {
                if (err) return reject(err);
                return resolve();
            });
        })
    }
    access(path, mode) {
        return new Promise((resolve, reject) => {
            fs.access(path, mode, err => {
                if (err) reject(err)
                resolve({ path, mode })
            })
        })
    }
    isExists(path) {
        return this.access(path, fs.constants.F_OK)
    }
    accessRead(path) {
        return this.access(path, fs.constants.R_OK)
    }
}

export class RxFileSystem {
    constructor() {
        this.filesystem = new FileSystem()
    }
    readFile(file) {
        return Rx.Observable.fromPromise(this.filesystem.readFile(file))
    }
    saveFile(file, data) {
        return Rx.Observable.fromPromise(this.filesystem.saveFile(file, data))
    }
    appendFile(file, data) {
        return Rx.Observable.fromPromise(this.filesystem.appendFile(file, data))
    }
    readJson(file) {
        return Rx.Observable.fromPromise(this.filesystem.readJson(file))
    }
    saveJson(file, data) {
        return Rx.Observable.fromPromise(this.filesystem.saveJson(file, data))
    }
    createReadStream(file) {
        return Rx.Observable.of(fs.createReadStream(file))
    }
    access(path, mode) {
        return Rx.Observable.fromPromise(this.filesystem.access(path, mode))
    }
    isExists(path) {
        return this.access(path, fs.constants.F_OK)
            .flatMap(() => Rx.Observable.of(true))
            .catch(() => Rx.Observable.of(false))
    }
    accessRead(path) {
        return this.access(path, fs.constants.R_OK)
            .flatMap(() => Rx.Observable.of(true))
            .catch(() => Rx.Observable.of(false))
    }
}
