import { query } from 'express'
import * as net from 'net'

export default class svdrp {
    constructor(){}

    querySvdrp (PORT: number, HOST: string, COMMAND: string) {
        return new Promise((resolve, reject) => {
            let dataFinished: string = ''
            // let dataFinishedCount: number = 0
            var socket = net.createConnection(PORT, HOST)
            socket.setTimeout(1500)
            socket.on('connect', () => {
                socket.write(`${COMMAND}\n`)
                socket.on('data', (data) => {
                    
                    dataFinished += data
                    // console.log(`alter Stand: ${dataFinishedCount} zu ${dataFinished.length}`)
                    // if (dataFinishedCount === dataFinished.length) {
                    //     socket.emit('end')
                    //     console.log('emitted end')
                    // }
                    // dataFinishedCount = dataFinished.length
                    // console.log(`Aktuelle Groesse von dataFinished: ${dataFinishedCount}`)
    
                })
                socket.on('timeout', () => {
                    socket.destroy()
                    // console.log(`data before splig by rn: ${dataFinished}`)
                    let lines: string[] = dataFinished.split('\r\n')
                    if (lines[0].startsWith('220')) {
                        lines.splice(0, 1)
                    }
                    // console.log(lines[0])
                    // Sanitize Lines for Response
                    // - 220 - general VDR Info
                    // - in Lines umbrechen
                    // - als JSON aufbereiten
                    // - letzte Zeile enthalt ein Leerzeichen statt eines Bindestrick
                    //   nach der ersten Spalte

                    // console.log(`Data inside socket-function: ${dataFinished}`)
                    // console.log(`Type in svdrp-function ${typeof(lines)}`)
                    resolve(lines)
                    // resolve(dataFinished)
                })
            })
        })
    }
}

export {svdrp}