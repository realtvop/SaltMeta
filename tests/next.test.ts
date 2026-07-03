import { describe, expect, test } from "bun:test";
import {
    compactNextMusicMetadata,
    convertLegacyToNext,
    convertNextCompactedToNormal,
    convertNextToLegacy,
    type MusicMetadataNext,
} from "../types";
import { createChineseChartMetadataKey, convertLxnsSongList } from "../updater/sources/lxns";
import { convertChartStats, createChartStatsKey } from "../updater/sources/diving-fish";

const fixture: MusicMetadataNext = {
    versions: [
        {
            version: "CiRCLE",
            word: "C",
            releaseDate: "2026-01-01",
            cnVerOverride: null,
        },
        {
            version: "PRiSM PLUS",
            word: "P",
            releaseDate: "2027-01-01",
            cnVerOverride: null,
        },
    ],
    musics: [
        {
            id: 1,
            title: "Fixture Song",
            artist: "Fixture Artist",
            bpm: 180,
            category: "maimai",
            isLocked: false,
            comment: "Utage-only fixture comment",
            charts: [
                {
                    type: "dx",
                    difficulty: 2,
                    noteDesigner: "",
                    noteCounts: {
                        tap: 1145,
                        hold: 14,
                        slide: 19,
                        touch: 19,
                        break: 810,
                        total: 2007,
                    },
                    regions: {
                        jp: {
                            level: "12",
                            internalLevel: 12,
                            version: "CiRCLE",
                        },
                        intl: {
                            level: "12+",
                            internalLevel: 12.7,
                            version: "PRiSM PLUS",
                        },
                        us: null,
                        cn: {
                            level: "12+",
                            internalLevel: 12.7,
                            version: 2027,
                        },
                    },
                },
            ],
        },
    ],
};

describe("next metadata", () => {
    test("uses stable keys for Chinese per-chart metadata", () => {
        expect(createChineseChartMetadataKey(8, "sd", 3)).toBe("8:sd:3");
        expect(createChineseChartMetadataKey(100517, "utage", 10)).toBe("100517:utage:10");
    });

    test("converts LXNS song list data to Chinese per-chart metadata", () => {
        const arcadeVersions = Array.from({ length: 17 }, (_, index) => ({
            version: index === 15 ? "Splash" : index === 16 ? "Splash PLUS" : `Version ${index}`,
            word: "",
            releaseDate: "2026-01-01",
            cnVerOverride: null,
        }));
        const converted = convertLxnsSongList({
            versions: [
                { id: 21, title: "舞萌DX 2024", version: 24000 },
                { id: 23, title: "舞萌DX 2025", version: 25000 },
            ],
            songs: [
                {
                    id: 100517,
                    difficulties: {
                        utage: [
                            {
                                type: "utage",
                                difficulty: 0,
                                level: "13+?",
                                level_value: 13.7,
                                version: 24000,
                            },
                        ],
                    },
                },
                {
                    id: 10517,
                    difficulties: {
                        dx: [
                            {
                                type: "dx",
                                difficulty: 3,
                                level: "12+",
                                level_value: 12.8,
                                version: 25000,
                            },
                        ],
                    },
                },
            ],
        }, arcadeVersions);

        expect(converted.chartMetadata.get("100517:utage:10")).toEqual({
            level: "13+?",
            internalLevel: 13.7,
            version: "舞萌DX 2024",
        });
        expect(converted.chartMetadata.get("517:dx:3")).toEqual({
            level: "12+",
            internalLevel: 12.8,
            version: "舞萌DX 2025",
        });
        expect(converted.versionOverrides).toEqual(new Map([
            ["Splash", 2024],
            ["Splash PLUS", 2024],
        ]));
    });

    test("round-trips per-region chart data through compacted format", () => {
        const compacted = compactNextMusicMetadata(fixture);
        const expanded = convertNextCompactedToNormal(compacted);

        expect(expanded.musics[0].charts[0].regions.jp).toEqual({
            level: "12",
            internalLevel: 12,
            version: "CiRCLE",
        });
        expect(expanded.musics[0].charts[0].regions.intl).toEqual({
            level: "12+",
            internalLevel: 12.7,
            version: "PRiSM PLUS",
        });
        expect(expanded.musics[0].charts[0].regions.cn).toEqual({
            level: "12+",
            internalLevel: 12.7,
            version: 2027,
        });
        expect(expanded.musics[0].charts[0].regions.us).toBeUndefined();
        expect(expanded.musics[0].comment).toBe("Utage-only fixture comment");
    });

    test("reads next compacted metadata without the optional comment slot", () => {
        const compacted = compactNextMusicMetadata(fixture);
        const oldCompacted = {
            ...compacted,
            musics: compacted.musics.map(music => music.slice(0, 8)),
        };

        expect(convertNextCompactedToNormal(oldCompacted).musics[0].comment).toBeUndefined();
    });

    test("keeps raw numeric and unknown string versions unambiguous", () => {
        const unknownVersionFixture: MusicMetadataNext = {
            ...fixture,
            musics: [
                {
                    ...fixture.musics[0],
                    charts: [
                        {
                            ...fixture.musics[0].charts[0],
                            regions: {
                                cn: {
                                    level: "13",
                                    internalLevel: 13.1,
                                    version: "舞萌DX 2028",
                                },
                            },
                        },
                    ],
                },
            ],
        };

        const compacted = compactNextMusicMetadata(unknownVersionFixture);
        expect(compacted.musics[0][6][0][2][0][3]).toEqual(["raw", "舞萌DX 2028"]);
        expect(convertNextCompactedToNormal(compacted).musics[0].charts[0].regions.cn?.version).toBe("舞萌DX 2028");
    });

    test("projects next metadata to legacy metadata with jp priority", () => {
        const legacy = convertNextToLegacy(fixture);
        const chart = legacy.musics[0].charts[0];

        expect(chart.level).toBe("12");
        expect(chart.internalLevel).toBe(12);
        expect(chart.version).toBe("CiRCLE");
        expect(chart.availableRegions).toEqual(["jp", "intl", "cn"]);
        expect(chart.regionVersionOverride).toEqual({
            intl: "PRiSM PLUS",
            cn: 2027,
        });
    });

    test("can lift legacy metadata into next metadata", () => {
        const legacy = convertNextToLegacy(fixture);
        const lifted = convertLegacyToNext(legacy);

        expect(lifted.musics[0].charts[0].regions.jp).toEqual({
            level: "12",
            internalLevel: 12,
            version: "CiRCLE",
        });
        expect(lifted.musics[0].charts[0].regions.cn).toEqual({
            level: "12",
            internalLevel: 12,
            version: 2027,
        });
    });

    test("maps diving-fish chart_stats ids with the dx +10000 offset and camelCase keys", () => {
        const chartStats = convertChartStats({
            charts: {
                "1235": [{}, {}, {}, { cnt: 10, diff: "14", fit_diff: 14.1, avg: 98, avg_dx: 100, std_dev: 1.2, dist: [], fc_dist: [] }, {}],
                "11235": [{}, {}, {}, { cnt: 20, diff: "14+", fit_diff: 14.4, avg: 97, avg_dx: 200, std_dev: 2.1, dist: [], fc_dist: [] }, {}],
                "100517": [{ cnt: 5, diff: "12?", fit_diff: 12.4, avg: 94, avg_dx: 50, std_dev: 3.3, dist: [], fc_dist: [] }, {}, {}, {}, {}],
            },
        });

        expect(chartStats.chartMetadata.get(createChartStatsKey(1235, "sd", 3))).toEqual({
            cnt: 10,
            diff: "14",
            fitDiff: 14.1,
            avg: 98,
            avgDx: 100,
            stdDev: 1.2,
            dist: [],
            fcDist: [],
        });
        expect(chartStats.chartMetadata.get(createChartStatsKey(1235, "dx", 3))).toEqual({
            cnt: 20,
            diff: "14+",
            fitDiff: 14.4,
            avg: 97,
            avgDx: 200,
            stdDev: 2.1,
            dist: [],
            fcDist: [],
        });
        expect(chartStats.chartMetadata.get(createChartStatsKey(100517, "utage", 10))).toEqual({
            cnt: 5,
            diff: "12?",
            fitDiff: 12.4,
            avg: 94,
            avgDx: 50,
            stdDev: 3.3,
            dist: [],
            fcDist: [],
        });
    });

    test("round-trips fitDiffDF through compacted next metadata", () => {
        const fitDiffDF = {
            cnt: 1345,
            diff: "12",
            fitDiff: 11.98,
            avg: 99.37,
            avgDx: 780.46,
            stdDev: 1.61,
            dist: [16, 2, 3, 2, 4, 49, 84, 243, 229, 524, 416, 603, 1268, 2326],
            fcDist: [1687, 1187, 2281, 312, 302],
        };
        const withFitDiff: MusicMetadataNext = {
            ...fixture,
            musics: [
                {
                    ...fixture.musics[0],
                    charts: [
                        {
                            ...fixture.musics[0].charts[0],
                            fitDiffDF,
                        },
                    ],
                },
            ],
        };

        const compacted = compactNextMusicMetadata(withFitDiff);
        const expanded = convertNextCompactedToNormal(compacted);
        expect(expanded.musics[0].charts[0].fitDiffDF).toEqual(fitDiffDF);

        const legacy = convertNextToLegacy(withFitDiff);
        expect((legacy.musics[0].charts[0] as { fitDiffDF?: unknown }).fitDiffDF).toBeUndefined();
    });
});
