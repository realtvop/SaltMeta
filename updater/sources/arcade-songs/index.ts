import type { MusicMetadataNext } from "../../../types";
import { convertArcadeSongsData } from "./converter";
import type { ArcadeSongsData } from "./types";
import { fetchLxnsData } from "../lxns";
import { fetchChartStats } from "../diving-fish";

const DATA_URL = "https://dp4p6x0xfi5o9.cloudfront.net/maimai/data.json";

async function fetchArcadeSongsData(): Promise<ArcadeSongsData> {
    const response = await fetch(DATA_URL);
    const data = await response.json() as ArcadeSongsData;
    return data;
}

export async function getArcadeSongsData(): Promise<MusicMetadataNext> {
    const arcadeData = await fetchArcadeSongsData();
    const [lxnsData, chartStats] = await Promise.all([
        fetchLxnsData(arcadeData.versions),
        fetchChartStats(),
    ]);
    return convertArcadeSongsData(arcadeData, lxnsData, chartStats);
}
