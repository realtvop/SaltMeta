import type { ChartCompacted, MusicCompacted, VersionCompacted } from "./compacted";
import type { Music, Version } from "./normal";
import type { AvailableRegion } from "./data";
import { categories } from "./data";
export {
    compactNextMusicMetadata,
    convertLegacyToNext,
    convertNextCompactedToNormal,
    convertNextToLegacy,
    NEXT_COMPACTED_VERSION,
} from "./next";

export type { Music, Chart, FitDiffDF, Version } from "./normal";
export type { MusicCompacted, ChartCompacted, VersionCompacted, FitDiffDFCompacted } from "./compacted";
export { compactFitDiffDF, expandFitDiffDF } from "./compacted";
export type {
    ChartNext,
    ChartNextCompacted,
    ChartRegionCompacted,
    ChartRegionData,
    ChartRegions,
    MusicMetadataNext,
    MusicMetadataNextCompacted,
    MusicNext,
    MusicNextCompacted,
    VersionReferenceCompacted,
} from "./next";
export type { AvailableRegion, MusicDifficultyID } from "./data";

export { categories } from "./data";

export interface MusicMetadata {
    musics: Music[];
    versions: Version[];
}

export interface MusicMetadataCompacted {
    musics: MusicCompacted[];
    versions: VersionCompacted[];
}

export function compactMusicMetadata(metadata: MusicMetadata): MusicMetadataCompacted {
    const versionIndexMap = new Map<string, number>();
    metadata.versions.forEach((version, index) => versionIndexMap.set(version.version, index));

    const versions: VersionCompacted[] = metadata.versions.map(version => [
        version.version,
        version.word,
        version.releaseDate,
        version.cnVerOverride,
    ]);

    const musics: MusicCompacted[] = metadata.musics.map(music => {
        const categoryIndex = categories.indexOf(music.category);
            const aliasesCn = music.aliases?.cn?.length ? music.aliases.cn : null;

        const charts: ChartCompacted[] = music.charts.map(chart => {
            const typeIndex = chart.type === "sd" ? 0 : chart.type === "dx" ? 1 : 2;
            const versionIndex = chart.version ? versionIndexMap.get(chart.version) ?? -1 : -1;

            const regionVersionOverrideCompacted = chart.regionVersionOverride && Object.keys(chart.regionVersionOverride).length
                ? Object.entries(chart.regionVersionOverride) as [AvailableRegion, string | number][]
                : null;

            return [
                typeIndex,
                chart.difficulty,
                chart.level,
                chart.internalLevel,
                versionIndex,
                regionVersionOverrideCompacted,
                chart.noteDesigner,
                [
                    chart.noteCounts.tap,
                    chart.noteCounts.hold,
                    chart.noteCounts.slide,
                    chart.noteCounts.touch ?? 0,
                    chart.noteCounts.break,
                ],
                chart.availableRegions,
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
        ];
    });

    return { musics, versions };
}
