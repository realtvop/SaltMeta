import type { ChartNext } from "../../types";

const LX_SONG_LIST_API_URL = "https://maimai.lxns.net/api/v0/maimai/song/list";

export interface ChineseChartMetadata {
    level: string;
    internalLevel: number;
    version: string;
}

interface LxnsVersion {
    id: number;
    title: string;
    version: number;
}

interface LxnsDifficulty {
    type: "standard" | "dx" | "utage";
    difficulty: number;
    level: string;
    level_value: number;
    version: number;
}

interface LxnsSong {
    id: number;
    difficulties?: Partial<Record<"standard" | "dx" | "utage", LxnsDifficulty[]>>;
}

interface LxnsSongList {
    songs?: LxnsSong[];
    versions?: LxnsVersion[];
}

interface LxnsDataMaps {
    chartMetadata: Map<string, ChineseChartMetadata>;
    versionOverrides: Map<string, number>;
}

interface ArcadeVersionLike {
    version: string;
}

function getSongMatchId(songId: number): number {
    return songId < 100000 ? songId % 10000 : songId;
}

function buildVersionTable(songList: LxnsSongList): LxnsVersion[] {
    return (songList.versions ?? [])
        .filter(version => typeof version.version === "number" && typeof version.title === "string")
        .sort((a, b) => a.version - b.version);
}

function resolveVersionTitle(versionValue: number, versionTable: LxnsVersion[]): string | null {
    for (let i = 0; i < versionTable.length; i++) {
        const current = versionTable[i];
        const next = versionTable[i + 1];
        if (!current) continue;

        if (!next) return versionValue >= current.version ? current.title : null;
        if (versionValue >= current.version && versionValue < next.version) return current.title;
    }

    return null;
}

function normalizeVersionTitle(title: string): string {
    return title.startsWith("舞萌") || title.startsWith("maimai") ? title : `maimai ${title}`;
}

function getChartType(type: LxnsDifficulty["type"]): ChartNext["type"] {
    return type === "standard" ? "sd" : type;
}

function getDifficulty(chartType: ChartNext["type"], difficulty: number): ChartNext["difficulty"] {
    return chartType === "utage" ? 10 : difficulty as ChartNext["difficulty"];
}

export function createChineseChartMetadataKey(
    musicId: number,
    chartType: ChartNext["type"],
    difficulty: ChartNext["difficulty"],
): string {
    return `${musicId}:${chartType}:${difficulty}`;
}

function addChartMetadata(
    metadata: Map<string, ChineseChartMetadata>,
    song: LxnsSong,
    difficulty: LxnsDifficulty,
    versionTable: LxnsVersion[],
): void {
    if (!difficulty.level || typeof difficulty.level_value !== "number") return;

    const versionTitle = resolveVersionTitle(difficulty.version, versionTable);
    if (!versionTitle) return;

    const chartType = getChartType(difficulty.type);
    metadata.set(createChineseChartMetadataKey(
        getSongMatchId(Number(song.id)),
        chartType,
        getDifficulty(chartType, difficulty.difficulty),
    ), {
        level: difficulty.level,
        internalLevel: difficulty.level_value,
        version: normalizeVersionTitle(versionTitle),
    });
}

function extractYear(title: string): number | null {
    const matched = title.match(/\b(20\d{2})\b/);
    return matched ? Number(matched[1]) : null;
}

function buildVersionOverrides(versionTable: LxnsVersion[], arcadeVersions: ArcadeVersionLike[]): Map<string, number> {
    const years = versionTable
        .map(version => extractYear(version.title))
        .filter((year): year is number => year !== null);
    const overrides = new Map<string, number>();
    let yearIndex = 0;
    const overrideStartIndex = arcadeVersions.findIndex(version => version.version === "Splash");
    if (overrideStartIndex === -1) return overrides;

    for (let index = overrideStartIndex; index < arcadeVersions.length; index++) {
        const version = arcadeVersions[index];
        if (!version) continue;

        const year = years[yearIndex];
        if (!year) break;

        overrides.set(version.version, year);
        if ((index - overrideStartIndex) % 2 === 1) yearIndex++;
    }

    return overrides;
}

export function convertLxnsSongList(songList: LxnsSongList, arcadeVersions: ArcadeVersionLike[]): LxnsDataMaps {
    const versionTable = buildVersionTable(songList);
    const chartMetadata = new Map<string, ChineseChartMetadata>();

    for (const song of songList.songs ?? []) {
        const id = Number(song.id);
        if (!Number.isFinite(id)) continue;

        for (const type of ["standard", "dx", "utage"] as const) {
            for (const difficulty of song.difficulties?.[type] ?? []) {
                addChartMetadata(chartMetadata, { ...song, id }, difficulty, versionTable);
            }
        }
    }

    return {
        chartMetadata,
        versionOverrides: buildVersionOverrides(versionTable, arcadeVersions),
    };
}

export async function fetchLxnsData(arcadeVersions: ArcadeVersionLike[]): Promise<LxnsDataMaps> {
    const response = await fetch(LX_SONG_LIST_API_URL);
    const songList = await response.json() as LxnsSongList;
    return convertLxnsSongList(songList, arcadeVersions);
}
