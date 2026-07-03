import type { MusicMetadataNext } from "../../../types";
import { convertArcadeSongsData } from "./converter";
import type { ArcadeSongsData } from "./types";
import { fetchLxnsData } from "../lxns";

const DATA_URL = "https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json";

async function fetchArcadeSongsData(): Promise<ArcadeSongsData> {
    const response = await fetch(DATA_URL);
    const data = await response.json() as ArcadeSongsData;
    return data;
}

export function getArcadeSongsData(): Promise<MusicMetadataNext> {
    return fetchArcadeSongsData().then(async arcadeData =>
        convertArcadeSongsData(arcadeData, await fetchLxnsData(arcadeData.versions)),
    );
}
