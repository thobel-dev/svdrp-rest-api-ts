
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
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTC')
    // console.log(`Data from Socket: ${data}`)
    res.status(200).json({data: data})
});
app.get('/channels/:name', async (req: Request, res: Response) => {
    let channelsDetails: string[][] = []
    let channelName: string = req.params.name
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTC')
    let possibleChannels: string[] = data.filter((item: string) => {
        return item.toLowerCase().indexOf(channelName.toLowerCase()) > -1
    })
    const separator: RegExp = /([\:\;])/g
    possibleChannels.forEach(channel => {
        let channelDetails: string[] = channel.split(separator)
        channelsDetails.push(channelDetails)
    });
    
    // console.log(channelDetails)
    res.status(200).json({data: channelsDetails})
});
app.get('/epg/:id', async (req: Request, res: Response) => {
    let id: string = ` ${req.params.id}`
    // console.log(id)
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
    let jsonEpg = []
    let epgData: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, `LSTE${id}`)
    // epg has different line break, so prepare for further transformation
    let data: string[] = epgData[0].split('\n')
    // console.log(`Type von data: ${typeof(data)} mit ${data.length} Elementen`)
    // build epg-json from string-array - interationCounter has to be used inside loop itself
    let iterationCounter: number = 0
    let itemCount = 0
    while (iterationCounter < data.length - 1) {
        let epgLine: string = data[iterationCounter]
        // console.log(`iterationCounter in first loop: ${iterationCounter}`)
        // console.log(`first epgLine: ${epgLine}`)
        // new channel
        if (epgLine.startsWith(EPG_CHANNEL_PREFIX)) {
         
            let newChannel: epgJson.epgChannelJson = {
                name: epgLine.replace(EPG_CHANNEL_PREFIX, ''),
                channelId: parseInt(id),
                epgEntries: []
            }
            iterationCounter++
            // find all details for the channel
            while (!epgLine.startsWith('215-c ') && iterationCounter < data.length - 1) {
                // console.log(`iterationCounter in second loop: ${iterationCounter}`)
                // find all details for every single epg-entry
                // iterationCounter++
                epgLine = data[iterationCounter]
                let epgEntry = {} as epgJson.epgEntry
                while (!(epgLine === '') && !epgLine.startsWith('215-e') && iterationCounter < data.length - 1) {
                    // console.log(`iterationCounter in third loop: ${iterationCounter}`)
                    epgLine = data[iterationCounter]
                    // console.log(`currentline: ${epgLine}`)
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
                    iterationCounter++;
                }
                itemCount++
                
                if (epgEntry.startZeit && epgEntry.startZeit !== '') {
                    let copyOfEpgEntry = JSON.parse(JSON.stringify(epgEntry))
                    newChannel.epgEntries.push(copyOfEpgEntry)
                }
            }
            jsonEpg.push(newChannel)
        }
    }

    // console.log(`Data from Socket: ${data}`)
    // console.log(`jsonEpg created: ${jsonEpg}`)
    res.status(200).json({data: jsonEpg})
});
app.get('/recordings', async (req: Request, res: Response) => {
    let data: any = await svdrpBackend.querySvdrp(parseInt(PORT!), HOST!, 'LSTR')
    // console.log(`Data from Socket: ${data}`)
    res.status(200).json({data: data})
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
    if (data.length > 1) {
        data.forEach( function (timer: string) {
            let timerDetails: string[] = timer.split(':')
            let jsonTimerDetails = {} as epgJson.jsonTimerDetails
            if (timerDetails.length > 1) {
                jsonTimerDetails = {
                    id: parseInt(timerDetails[0].replace('-', ' ').split(' ')[1]),
                    channelId: timerDetails[1],
                    startdatum: timerDetails[2],
                    startzeit: `${timerDetails[3].slice(0,2)}:${timerDetails[3].slice(2)}`,
                    endzeit: `${timerDetails[4].slice(0,2)}:${timerDetails[4].slice(2)}`,
                    titel: timerDetails[7],
                }
                console.log(jsonTimerDetails)
            }
            resData.push(jsonTimerDetails)
        })
    }
    res.status(200).json({data: resData})
});
app.post('/timers', async (req: Request, res: Response) => {
    let timerDetails: string = req.body.timerDetails
    console.log(`timer details: ${timerDetails}`)
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