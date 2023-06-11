import * as net from 'net'

export default class svdrp {
    constructor(){}

    querySvdrp (PORT: number, HOST: string, COMMAND: string) {
        return new Promise((resolve, reject) => {
            let dataFinished: string = ''
            var socket = net.createConnection(PORT, HOST)
            socket.setTimeout(1500)
            socket.on('connect', () => {
                socket.write(`${COMMAND}\n`)
                socket.on('data', (data) => {
                    dataFinished += data
                })
                socket.on('timeout', () => {
                    socket.destroy()
                    let lines: string[] = dataFinished.split('\r\n')
                    if (lines[0].startsWith('220')) {
                        lines.splice(0, 1)
                    }
                    resolve(lines)
                })
            })
        })
    }
}

export {svdrp}