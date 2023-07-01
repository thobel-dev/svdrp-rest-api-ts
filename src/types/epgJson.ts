export type epgChannelJson = {
    channelId: string,
    name: string,
    epgEntries: epgEntry[]
}

export type epgEntry = {
    beschreibung: string,
    endZeit: string,
    endZeitTimer: string,
    genre: string,
    jugendfreigabe: string,
    kurztext: string,
    mediendetails: string,
    startDatumTimer: string,
    startZeit: string,
    startZeitH: string,
    startZeitTimer: string,
    titel: string,
}

export type jsonTimerDetails = {
    id: number,
    channelId: string,
    startdatum: string,
    startzeit: string,
    endzeit: string,
    titel: string,
}

export type jsonChannelDetails = {
    id: number,
    channelname: string,
    channelDetails: string
}

export type jsonRecording = {
    id: number,
    datum: string,
    zeit: string,
    dauer: string,
    neu: boolean,
    titel: string
}