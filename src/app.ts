
import * as dotenv from 'dotenv'
import express, { Application, Request, Response } from 'express'
import * as svdrp from './svdrp'
import * as epgJson from './types/epgJson'

const app: Application = express();
// use .env-file
dotenv.config()

const PORT = process.env.SVDRP_PORT
const HOST = process.env.SVDRP_HOST
const EPG_CHANNEL_PREFIX = '215-C '
let svdrpBackend = new svdrp.default()
app.use(express.json())


app.get('/', async (req: Request, res: Response) => {
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'HELP')
    // console.log(`Data from Socket: ${data}`)
    res.status(200).json({data: data})
});
app.get('/channels', async (req: Request, res: Response) => {
    const channelDetailsSeparator: RegExp = /([\:\;\,])/g
    const channelSeparator: RegExp = /([^\d]+)/g
    let resData: Array<epgJson.jsonChannelDetails> = []
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTC')
    data.forEach(function (channel: string) {
        if (channel !== '') {
            let channelDetail: epgJson.jsonChannelDetails = {} as epgJson.jsonChannelDetails
            let channelDetails: string[] = channel.split(channelDetailsSeparator)
            let channelIdAndName: string = channelDetails[0].substring(4,channelDetails[0].length)
            let channelIdArray: string[] = channelIdAndName.split(channelSeparator)
            console.log(channelIdArray)
            channelDetail.id = parseInt(channelIdArray[0])
            channelDetail.channelname = channelIdArray.slice(1, channelIdArray.length - 1).join('')
            channelDetail.channelDetails = channel
            resData.push(channelDetail)
        }        
    })
    res.status(200).json({data: resData})
});
// app.get('/channels/:name', async (req: Request, res: Response) => {
//     let channelsDetails: string[][] = []
//     let channelName: string = req.params.name
//     let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTC')
//     let possibleChannels: string[] = data.filter((item: string) => {
//         return item.toLowerCase().indexOf(channelName.toLowerCase()) > -1
//     })
//     const separator: RegExp = /([\:\;])/g
//     possibleChannels.forEach(channel => {
//         let channelDetails: string[] = channel.split(separator)
//         channelsDetails.push(channelDetails)
//     });
    
//     // console.log(channelDetails)
//     res.status(200).json({data: channelsDetails})
// });
app.get('/epg/:id', async (req: Request, res: Response) => {
    let id: string = ` ${req.params.id}`
    /** Aufbau eines EPG-Eintrags
     *  C <channelID> <KanalName>	Beginn eines neuen Kanals
        E <EventID> <StartZeit> <Dauer> <TableID> <Version>	Beginn eines neuen Eintrags
        T <Titel>	Setzt den Titel des aktuellen Eintragsfest
        S <Kurztext>	kurze Beschreibung des Eintrags
        D <Beschreibung>	Beschreibung des Eintrags. Pipe "|" wird als Zeilentrennzeichen verwendet
        G <Nummer>	Genre (ab VDR-1.7.11)
        R <parental rating>	Parental Rating, empfohlenes Mindestalter für eine Sendung
        X <Datenstromart> <Typ> <Sprache> <Beschreibung>	Angaben zum Video-/Audio-Stream
        V <VPS>	VPS Zeit angeben
        e	Eintrag beendet
        c	Kanal beendet
     */
    let jsonEpg: any = []
    let epgData: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, `LSTE${id}`)
    // epg has different line break, so prepare for further transformation
    let data: string[] = epgData[0].split('\n')
    // console.log(`Type von data: ${typeof(data)} mit ${data.length} Elementen`)
    // build epg-json from string-array - interationCounter has to be used inside loop itself
    // let iterationCounter: number = 0
    // let itemCount = 0
    
    let epgEntry = {} as epgJson.epgEntry
    let newChannel = {} as epgJson.epgChannelJson

    data.forEach(epgLine => {

        // new channel
        if (epgLine.startsWith(EPG_CHANNEL_PREFIX)) {
            let channelDetails = epgLine.replace(EPG_CHANNEL_PREFIX, '') 
            newChannel.name = channelDetails.substring(channelDetails.indexOf(' ') + 1)
            newChannel.channelId = epgLine.replace(EPG_CHANNEL_PREFIX, '')
            newChannel.epgEntries = []
        }

        // channel end
        if (epgLine.startsWith('215-c')) {
            let copyOfNewChannel = JSON.parse(JSON.stringify(newChannel))
            jsonEpg.push(copyOfNewChannel)
        }

        // new EPG-entry
        if (epgLine.startsWith('215-E')) {
            epgEntry.startZeit = epgLine.replace('215-E ', '')
            let startTimeDate = new Date(parseInt(epgLine.split(' ')[2]) * 1000)
            epgEntry.startZeitH = startTimeDate.toLocaleString()
            let dateTimeParts: string[] = epgEntry.startZeitH.split(', ')
            let dateParts: string[] = dateTimeParts[0].split('.')
            let timeParts: string[] = dateTimeParts[1].split(':')
            epgEntry.startDatumTimer = `${dateParts[2]}-${(0+dateParts[1]).slice(-2)}-${(0+dateParts[0]).slice(-2)}`
            epgEntry.startZeitTimer = `${timeParts[0]}${timeParts[1]}`
            startTimeDate.setSeconds(startTimeDate.getSeconds() + parseInt(epgLine.split(' ')[3]))
            epgEntry.endZeit = startTimeDate.toLocaleString()
            let endZeitDateTimeParts = epgEntry.endZeit.split(', ')
            let endZeitDateParts = endZeitDateTimeParts[0].split('.')
            let endZeitTimeParts = endZeitDateTimeParts[1].split(':')
            epgEntry.endZeitTimer = `${endZeitTimeParts[0]}${endZeitTimeParts[1]}` 
        }
        if (epgLine.startsWith('215-T')) {
            epgEntry.titel = epgLine.replace('215-T ', '')
        }
        if (epgLine.startsWith('215-S')) {
            epgEntry.kurztext = epgLine.replace('215-S ', '')
        }
        if (epgLine.startsWith('215-D')) {
            epgEntry.beschreibung = epgLine.replace('215-D ', '')
        }
        if (epgLine.startsWith('215-G')) {
            epgEntry.genre = epgLine.replace('215-G ', '')
        }
        if (epgLine.startsWith('215-R')) {
            epgEntry.jugendfreigabe = epgLine.replace('215-R ', '')
        }
        if (epgLine.startsWith('215-X')) {
            epgEntry.mediendetails = epgLine.replace('215-X ', '')
        }
        if (epgLine.startsWith('215-e')) {
            let copyOfEpgEntry = JSON.parse(JSON.stringify(epgEntry))
            newChannel.epgEntries.push(copyOfEpgEntry)
        }
    });

    // let epgLine: string = ''
    // while (iterationCounter < data.length - 1) {
    //     epgLine = data[iterationCounter]
    //     // new channel
    //     if (epgLine.startsWith(EPG_CHANNEL_PREFIX)) {
    //         console.log(`New channel: ${epgLine}`)
    //         let newChannel: epgJson.epgChannelJson = {
    //             name: epgLine.replace(EPG_CHANNEL_PREFIX, ''),
    //             channelId: parseInt(id),
    //             epgEntries: []
    //         }
    //         iterationCounter++
    //         // find all details for the channel
    //         while (!epgLine.startsWith('215-c') && iterationCounter < data.length - 1) {
    //             // find all details for every single epg-entry
    //             epgLine = data[iterationCounter]
    //             console.log(`current line ${epgLine}`)
    //             let epgEntry = {} as epgJson.epgEntry
    //             while (!(epgLine === '') && !epgLine.startsWith('215-e') && !epgLine.startsWith('215-e') && iterationCounter < data.length - 1) {
    //                 epgLine = data[iterationCounter]
    //                 if (epgLine.startsWith('215-E')) {
    //                     epgEntry.startZeit = epgLine.replace('215-E ', '')
    //                     let startTimeDate = new Date(parseInt(epgLine.split(' ')[2]) * 1000)
    //                     epgEntry.startZeitH = startTimeDate.toLocaleString()
    //                     let dateTimeParts: string[] = epgEntry.startZeitH.split(', ')
    //                     let dateParts: string[] = dateTimeParts[0].split('.')
    //                     let timeParts: string[] = dateTimeParts[1].split(':')
    //                     epgEntry.startDatumTimer = `${dateParts[2]}-${(0+dateParts[1]).slice(-2)}-${(0+dateParts[0]).slice(-2)}`
    //                     epgEntry.startZeitTimer = `${timeParts[0]}${timeParts[1]}`
    //                     startTimeDate.setSeconds(startTimeDate.getSeconds() + parseInt(epgLine.split(' ')[3]))
    //                     epgEntry.endZeit = startTimeDate.toLocaleString()
    //                     let endZeitDateTimeParts = epgEntry.endZeit.split(', ')
    //                     let endZeitDateParts = endZeitDateTimeParts[0].split('.')
    //                     let endZeitTimeParts = endZeitDateTimeParts[1].split(':')
    //                     epgEntry.endZeitTimer = `${endZeitTimeParts[0]}${endZeitTimeParts[1]}` 
    //                 }
    //                 if (epgLine.startsWith('215-T')) {
    //                     epgEntry.titel = epgLine.replace('215-T ', '')
    //                 }
    //                 if (epgLine.startsWith('215-S')) {
    //                     epgEntry.kurztext = epgLine.replace('215-S ', '')
    //                 }
    //                 if (epgLine.startsWith('215-D')) {
    //                     epgEntry.beschreibung = epgLine.replace('215-D ', '')
    //                 }
    //                 if (epgLine.startsWith('215-G')) {
    //                     epgEntry.genre = epgLine.replace('215-G ', '')
    //                 }
    //                 if (epgLine.startsWith('215-R')) {
    //                     epgEntry.jugendfreigabe = epgLine.replace('215-R ', '')
    //                 }
    //                 if (epgLine.startsWith('215-X')) {
    //                     epgEntry.mediendetails = epgLine.replace('215-X ', '')
    //                 }
    //                 iterationCounter++;
    //             }
    //             itemCount++
                
    //             if (epgEntry.startZeit && epgEntry.startZeit !== '') {
    //                 let copyOfEpgEntry = JSON.parse(JSON.stringify(epgEntry))
    //                 newChannel.epgEntries.push(copyOfEpgEntry)
    //             }
    //         }
    //         jsonEpg.push(newChannel)
    //     }
    // }
    res.status(200).json({data: jsonEpg})
});
app.get('/recordings', async (req: Request, res: Response) => {
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTR')
    // 250 2 08.03.07 20:00 0:15* Tagesschau
    /**
     * 2 ist die Nummer der Aufnahme. Danach folgt Datum und Uhrzeit der Aufnahme, danach die Aufnahmedauer.
     * Der Stern hinter der Uhrzeit zeigt an, dass die Aufnahme neu ist. Als Letztes folgt der Titel der aufgenommenen Sendung.
     */
    let jsonRecording: any = []
    for (let i = 0; i < data.length - 1; i++) {
        let recording = data[i]
        let recordingDetails = recording.replace('250-','').replace('250 ','').split(' ')
        let title: string = recordingDetails[4]
        for (let i = 5; i < recordingDetails.length; i++) {
            title += ` ${recordingDetails[i]}`            
        }
        let currentRecording: epgJson.jsonRecording = {
            id: parseInt(recordingDetails[0]),
            datum: recordingDetails[1],
            zeit: recordingDetails[2],
            dauer: recordingDetails[3].indexOf('*') > -1 ? recordingDetails[3].substring(0, recordingDetails[3].length - 1) : recordingDetails[3],
            neu: recordingDetails[3].indexOf('*') > -1 ? true : false,
            titel: title

        }
        let addCurrentRecording = JSON.parse(JSON.stringify(currentRecording))
        jsonRecording.push(addCurrentRecording)
    }
    res.status(200).json({data: jsonRecording})
});
app.delete('/timers/:id', async (req: Request, res: Response) => {
    let id: number = parseInt(req.params.id)
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, `DELT ${id}`)
    if (data[0].toString().startsWith('250')) {
        res.status(200).json({data: data})
    }
    else {
        res.status(400).json({data: data})
    }
});
app.get('/timers', async (req: Request, res: Response) => {
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTT')
    let resData: Array<epgJson.jsonTimerDetails> = []
    // console.log(data)
    if (data.length > 1 && data[0] !== '550 No timers defined') {
        data.forEach( function (timer: string) {
            let timerDetails: string[] = timer.split(':')
            let jsonTimerDetails = {} as epgJson.jsonTimerDetails
            if (timerDetails.length > 1) {
                jsonTimerDetails = {
                    id: parseInt(timerDetails[0].replace('-', ' ').split(' ')[1]),
                    channelId: timerDetails[1],
                    startdatum: timerDetails[2],
                    startzeitH: `${timerDetails[3].slice(0,2)}:${timerDetails[3].slice(2)}`,
                    endzeitH: `${timerDetails[4].slice(0,2)}:${timerDetails[4].slice(2)}`,
                    startzeit: timerDetails[3],
                    endzeit: timerDetails[4],
                    titel: timerDetails[7],
                }
            }
            resData.push(jsonTimerDetails)
        })
    }
    res.status(200).json({data: resData})
});
app.post('/timers', async (req: Request, res: Response) => {
    let timerDetails: string = req.body.timerDetails
    // console.log(`timer details: ${timerDetails}`)
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, `NEWT ${timerDetails}`)
    // console.log(`Data from Socket: ${data}`)
    if (data[0].toString().startsWith('250')) {
        res.status(200).json({data: data})
    }
    else {
        res.status(400).json({data: data})
    }
});

app.listen(process.env.PORT, (): void => {
    console.log(`svdrp rest api running on port ${process.env.PORT}`)
})