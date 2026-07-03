import type { AvailableRegion, ChartNext, MusicMetadataNext, MusicNext, Version } from "../../../types";
import { matchSongID } from "../songid";
import { createChineseChartMetadataKey, type ChineseChartMetadata } from "../diving-fish";
import type { ArcadeSongsData, Sheet, Song, Version as VersionOri } from "./types";

export async function convertArcadeSongsData(
    data: ArcadeSongsData,
    cnChartMetadata: Map<string, ChineseChartMetadata>,
): Promise<MusicMetadataNext> {
    return {
        musics: (await Promise.all(data.songs.map(song => convertMusic(song, cnChartMetadata)))).filter(music => music.charts.length && music.id !== -1).sort((a, b) => a.id - b.id),
        versions: convertVersions(data.versions),
    };
}

function normalizeRegion(region: string): AvailableRegion {
    return (region === "usa" ? "us" : region) as AvailableRegion;
}

function getBaseLevel(sheet: Sheet): string {
    return getDifficulty(sheet) == -1 ? sheet.difficulty : sheet.level;
}

function getDifficulty(sheet: Sheet): number {
    return ["basic", "advanced", "expert", "master", "remaster"].indexOf(sheet.difficulty);
}

function getChartType(sheet: Sheet): ChartNext["type"] {
    return sheet.type.replace("std", "sd") as ChartNext["type"];
}

function getRegionOverride(sheet: Sheet, region: AvailableRegion): Partial<{
    level: string;
    internalLevel: number;
    internalLevelValue: number;
    version: string | number;
}> {
    const sourceRegion = region === "us" ? "usa" : region;
    return (sheet.regionOverrides as Record<string, unknown> | undefined)?.[sourceRegion] as Partial<{
        level: string;
        internalLevel: number;
        internalLevelValue: number;
        version: string | number;
    }> | undefined ?? {};
}

function convertChart(
    sheet: Sheet,
    musicId: number,
    cnChartMetadata: Map<string, ChineseChartMetadata>,
): ChartNext {
    const difficulty = getDifficulty(sheet);
    const chartType = getChartType(sheet);
    const difficultyId = difficulty == -1 ? 10 : difficulty;
    const baseLevel = getBaseLevel(sheet);
    const baseInternalLevel = sheet.internalLevelValue;
    const baseVersion = sheet.version;

    const regions: ChartNext["regions"] = {};

    for (const [regionRaw, available] of Object.entries(sheet.regions)) {
        if (!available) continue;

        const region = normalizeRegion(regionRaw);
        const override = getRegionOverride(sheet, region);
        regions[region] = {
            level: override.level ?? baseLevel,
            internalLevel: override.internalLevelValue ?? override.internalLevel ?? baseInternalLevel,
            version: override.version ?? baseVersion,
        };
    }

    const cnMetadata = cnChartMetadata.get(createChineseChartMetadataKey(musicId, chartType, difficultyId));
    if (cnMetadata) {
        regions.cn = {
            level: cnMetadata.level,
            internalLevel: cnMetadata.internalLevel,
            version: cnMetadata.version,
        };
    }

    return {
        type: chartType,
        difficulty: difficultyId,
        noteDesigner: sheet.noteDesigner,
        noteCounts: sheet.noteCounts,
        regions,
    };
}

async function convertMusic(song: Song, cnChartMetadata: Map<string, ChineseChartMetadata>): Promise<MusicNext> {
    const id = await matchSongID(song) ?? -1;

    const music: MusicNext = {
        id,
        title: song.title,
        artist: song.artist,
        bpm: song.bpm,

        category: song.category,
        isLocked: song.isLocked,

        charts: song.sheets.map(sheet => convertChart(sheet, id, cnChartMetadata)).filter(chart => Object.values(chart.regions).some(Boolean)),
    };

    return song.comment ? { ...music, comment: song.comment } : music;
}

function convertVersions(versions: VersionOri[]): Version[] {
    const data = [];
    for (const version of versions) {
        data.push({
            version: version.version,
            word: version.abbr.match(/\((.*?)\)/)?.[1] ?? "",
            releaseDate: version.releaseDate,
            cnVerOverride: null,
        });
    }
    return data;
}
