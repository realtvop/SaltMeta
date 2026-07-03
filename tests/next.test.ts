import { describe, expect, test } from "bun:test";
import {
    compactNextMusicMetadata,
    convertLegacyToNext,
    convertNextCompactedToNormal,
    convertNextToLegacy,
    type MusicMetadataNext,
} from "../types";
import { createChineseChartMetadataKey } from "../updater/sources/diving-fish";

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
});
