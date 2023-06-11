export type epgChannelJson = {
    channelId: number,
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