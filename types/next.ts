import type { AvailableRegion, MusicDifficultyID } from "./data";
import { categories } from "./data";
import type { Chart, FitDiffDF, Music, Version } from "./normal";
import { compactFitDiffDF, expandFitDiffDF, type FitDiffDFCompacted, type VersionCompacted } from "./compacted";

export interface ChartRegionData {
    level: string;
    internalLevel: number;
    version: string | number;
}

export type ChartRegions = Partial<Record<AvailableRegion, ChartRegionData | null>>;

export interface MusicNext {
    id: number;
    title: string;
    artist: string;
    bpm: number;

    aliases?: {
        cn: string[];
    };
    comment?: string;

    category: string;
    isLocked: boolean;

    charts: ChartNext[];
}

export interface ChartNext {
    type: "sd" | "dx" | "utage";
    difficulty: MusicDifficultyID;
    noteDesigner: string;
    noteCounts: {
        tap: number;
        hold: number;
        slide: number;
        touch: number | null;
        break: number;
        total: number;
    };
    regions: ChartRegions;
    fitDiffDF?: FitDiffDF;
}

export interface MusicMetadataNext {
    musics: MusicNext[];
    versions: Version[];
}

export type VersionReferenceCompacted = number | ["raw", string | number];

export type ChartRegionCompacted = [
    AvailableRegion,
    string,
    number,
    VersionReferenceCompacted,
];

export type ChartNextCompacted = [
    number, // type: [sd, dx, utage]
    MusicDifficultyID,
    ChartRegionCompacted[],

    string, // noteDesigner
    [number, number, number | null, number, number], // noteCounts: [tap, hold, slide, touch, break]
    FitDiffDFCompacted | null, // fitDiffDF
];

export type MusicNextCompacted = [
    number, // id: < 10000, same for sd and dx
    string, // title
    string, // artist
    number, // bpm

    number, // categoryIndex
    boolean, // isLocked

    ChartNextCompacted[], // charts
    string[] | null, // aliasesCn
    string | null, // comment
];

export interface MusicMetadataNextCompacted {
    musics: MusicNextCompacted[];
    versions: VersionCompacted[];
}

const regionPriority: AvailableRegion[] = ["jp", "intl", "us", "cn"] as AvailableRegion[];

function createVersionIndexMap(versions: Version[]): Map<string, number> {
    const versionIndexMap = new Map<string, number>();
    versions.forEach((version, index) => versionIndexMap.set(version.version, index));
    return versionIndexMap;
}

function compactVersionReference(
    version: string | number,
    versionIndexMap: Map<string, number>,
): VersionReferenceCompacted {
    if (typeof version === "number") {
        return ["raw", version];
    }

    const versionIndex = versionIndexMap.get(version);
    return versionIndex === undefined ? ["raw", version] : versionIndex;
}

function expandVersionReference(
    versionReference: VersionReferenceCompacted,
    versions: Version[],
    musicId: number,
): string | number {
    if (Array.isArray(versionReference)) {
        return versionReference[1];
    }

    const version = versions[versionReference];
    if (!version) {
        throw new Error(`Version index ${versionReference} not found for music ${musicId}`);
    }
    return version.version;
}

function normalizeRegions(regions: ChartRegions): Partial<Record<AvailableRegion, ChartRegionData>> {
    const normalized: Partial<Record<AvailableRegion, ChartRegionData>> = {};
    for (const region of regionPriority) {
        const data = regions[region];
        if (!data) continue;
        normalized[region] = data;
    }
    return normalized;
}

function firstAvailableRegion(regions: ChartRegions): [AvailableRegion, ChartRegionData] | null {
    for (const region of regionPriority) {
        const data = regions[region];
        if (data) return [region, data];
    }
    return null;
}

export function compactNextMusicMetadata(metadata: MusicMetadataNext): MusicMetadataNextCompacted {
    const versionIndexMap = createVersionIndexMap(metadata.versions);

    const versions: VersionCompacted[] = metadata.versions.map(version => [
        version.version,
        version.word,
        version.releaseDate,
        version.cnVerOverride,
    ]);

    const musics: MusicNextCompacted[] = metadata.musics.map(music => {
        const categoryIndex = categories.indexOf(music.category);
        const aliasesCn = music.aliases?.cn?.length ? music.aliases.cn : null;
        const comment = music.comment?.length ? music.comment : null;

        const charts: ChartNextCompacted[] = music.charts.map(chart => {
            const typeIndex = chart.type === "sd" ? 0 : chart.type === "dx" ? 1 : 2;
            const regions = normalizeRegions(chart.regions);
            const regionEntries = Object.entries(regions).map(([region, data]) => [
                region,
                data.level,
                data.internalLevel,
                compactVersionReference(data.version, versionIndexMap),
            ]) as ChartRegionCompacted[];

            return [
                typeIndex,
                chart.difficulty,
                regionEntries,
                chart.noteDesigner,
                [
                    chart.noteCounts.tap,
                    chart.noteCounts.hold,
                    chart.noteCounts.slide,
                    chart.noteCounts.touch ?? 0,
                    chart.noteCounts.break,
                ],
                chart.fitDiffDF ? compactFitDiffDF(chart.fitDiffDF) : null,
            ];
        });

        return [
            music.id,
            music.title,
            music.artist,
            music.bpm,
            categoryIndex,
            music.isLocked,
            charts,
            aliasesCn,
            comment,
        ];
    });

    return { musics, versions };
}

export function convertNextCompactedToNormal(compacted: MusicMetadataNextCompacted): MusicMetadataNext {
    if (!compacted || !Array.isArray(compacted.musics) || !Array.isArray(compacted.versions)) {
        throw new Error("Invalid next compacted metadata payload");
    }

    const versions = compacted.versions.map(([version, word, releaseDate, cnVerOverride]) => ({
        version,
        word,
        releaseDate,
        cnVerOverride,
    }));

    const musics: MusicNext[] = compacted.musics.map(compactedMusic => {
        const [id, title, artist, bpm, categoryIndex, isLocked, chartsCompacted, aliasesCn, comment] = compactedMusic;

        if (categoryIndex < 0 || categoryIndex >= categories.length) {
            throw new Error(`Category index ${categoryIndex} not found for music ${id}`);
        }
        const category = categories[categoryIndex]!;

        const charts: ChartNext[] = chartsCompacted.map(compactedChart => {
            if (!Array.isArray(compactedChart) || compactedChart.length < 5) {
                throw new Error(`Invalid next chart payload for music ${id}`);
            }

            const [typeIndex, difficulty, regionEntries, noteDesigner, noteCountsCompacted, fitDiffDFCompacted] = compactedChart;
            const type = typeIndex === 0 ? "sd" : typeIndex === 1 ? "dx" : typeIndex === 2 ? "utage" : null;
            if (!type) {
                throw new Error(`Chart type index ${typeIndex} not found for music ${id}`);
            }

            if (!Array.isArray(regionEntries)) {
                throw new Error(`Invalid next region payload for music ${id}`);
            }

            const regions: ChartRegions = {};
            for (const [region, level, internalLevel, versionReference] of regionEntries) {
                if (!regionPriority.includes(region)) {
                    throw new Error(`Region ${region} not found for music ${id}`);
                }
                regions[region] = {
                    level,
                    internalLevel,
                    version: expandVersionReference(versionReference, versions, id),
                };
            }

            if (!Array.isArray(noteCountsCompacted) || noteCountsCompacted.length < 5) {
                throw new Error(`Invalid next note counts for music ${id}`);
            }

            const [tap, hold, slideRaw, touchRaw, breakCount] = noteCountsCompacted;
            const slide = slideRaw ?? 0;
            const touch = type === "sd" ? null : touchRaw ?? 0;
            const total = tap + hold + slide + (touch ?? 0) + breakCount;

            return {
                type,
                difficulty,
                noteDesigner,
                noteCounts: {
                    tap,
                    hold,
                    slide,
                    touch,
                    break: breakCount,
                    total,
                },
                regions,
                ...(fitDiffDFCompacted && Array.isArray(fitDiffDFCompacted)
                    ? { fitDiffDF: expandFitDiffDF(fitDiffDFCompacted as FitDiffDFCompacted) }
                    : {}),
            };
        });

        const base: MusicNext = {
            id,
            title,
            artist,
            bpm,
            category,
            isLocked,
            charts,
        };
        const withAliases = aliasesCn && aliasesCn.length ? { ...base, aliases: { cn: aliasesCn } } : base;
        return comment ? { ...withAliases, comment } : withAliases;
    });

    return { musics, versions };
}

export function convertNextToLegacy(metadata: MusicMetadataNext): { musics: Music[]; versions: Version[] } {
    return {
        versions: metadata.versions,
        musics: metadata.musics.map(music => {
            const charts = music.charts.flatMap(chart => {
                const representative = firstAvailableRegion(chart.regions);
                if (!representative) return [];

                const [, representativeData] = representative;
                const version = typeof representativeData.version === "string" ? representativeData.version : null;
                const availableRegions = regionPriority.filter(region => Boolean(chart.regions[region]));

                const regionVersionOverride: Partial<Record<AvailableRegion, string | number>> = {};
                for (const region of availableRegions) {
                    const data = chart.regions[region];
                    if (!data) continue;
                    if (data.version !== version) {
                        regionVersionOverride[region] = data.version;
                    }
                }

                return {
                    type: chart.type,
                    difficulty: chart.difficulty,
                    level: representativeData.level,
                    internalLevel: representativeData.internalLevel,
                    version,
                    regionVersionOverride: Object.keys(regionVersionOverride).length ? regionVersionOverride : undefined,
                    noteDesigner: chart.noteDesigner,
                    noteCounts: chart.noteCounts,
                    availableRegions,
                } satisfies Chart;
            });

            const base: Music = {
                id: music.id,
                title: music.title,
                artist: music.artist,
                bpm: music.bpm,
                category: music.category,
                isLocked: music.isLocked,
                charts,
            };
            return music.aliases ? { ...base, aliases: music.aliases } : base;
        }),
    };
}

export function convertLegacyToNext(metadata: { musics: Music[]; versions: Version[] }): MusicMetadataNext {
    return {
        versions: metadata.versions,
        musics: metadata.musics.map(music => {
            const charts: ChartNext[] = music.charts.map(chart => {
                const regions: ChartRegions = {};
                for (const region of chart.availableRegions) {
                    regions[region] = {
                        level: chart.level,
                        internalLevel: chart.internalLevel,
                        version: chart.regionVersionOverride?.[region] ?? chart.version ?? "",
                    };
                }

                return {
                    type: chart.type,
                    difficulty: chart.difficulty,
                    noteDesigner: chart.noteDesigner,
                    noteCounts: chart.noteCounts,
                    regions,
                };
            });

            const base: MusicNext = {
                id: music.id,
                title: music.title,
                artist: music.artist,
                bpm: music.bpm,
                category: music.category,
                isLocked: music.isLocked,
                charts,
            };
            return music.aliases ? { ...base, aliases: music.aliases } : base;
        }),
    };
}
