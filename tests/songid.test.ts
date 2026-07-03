import { describe, expect, test } from "bun:test";
import type { Song } from "../updater/sources/arcade-songs/types";
import {
    matchSongIDFromCandidates,
    scoreCandidate,
    stringSimilarity,
    type SongIDCandidate,
} from "../updater/sources/songid";

function createSong(overrides: Partial<Song>): Song {
    return {
        songId: overrides.songId ?? overrides.title ?? "fixture",
        category: overrides.category ?? "maimai",
        title: overrides.title ?? "Fixture",
        artist: overrides.artist ?? "Fixture Artist",
        bpm: overrides.bpm ?? 120,
        imageName: overrides.imageName ?? "fixture.png",
        version: overrides.version ?? "maimai",
        releaseDate: overrides.releaseDate ?? "2012-07-11",
        isNew: overrides.isNew ?? false,
        isLocked: overrides.isLocked ?? false,
        comment: overrides.comment ?? null,
        sheets: overrides.sheets ?? [],
    };
}

function createSheets(levels: number[]): Song["sheets"] {
    return levels.map((level, index) => ({
        type: "std",
        difficulty: ["basic", "advanced", "expert", "master", "remaster"][index] as Song["sheets"][number]["difficulty"],
        level: String(level),
        levelValue: level,
        internalLevel: String(level),
        internalLevelValue: level,
        noteDesigner: "-",
        noteCounts: {
            tap: 0,
            hold: 0,
            slide: 0,
            touch: null,
            break: 0,
            total: 0,
        },
        regions: {
            jp: true,
            intl: true,
            usa: true,
            cn: true,
        },
        regionOverrides: {
            intl: {},
        },
        isSpecial: false,
        version: "maimai",
    }));
}

const linkCandidates: SongIDCandidate[] = [
    {
        id: "131",
        name: "Link",
        composer: "Clean Tears feat. Youna",
        genre: "maimai",
        notes: [{ lv: 6 }, { lv: 7.8 }, { lv: 12.6 }, { lv: 12.5 }, { lv: 13.5 }],
    },
    {
        id: "383",
        name: "Link",
        composer: "Circle of friends(天月-あまつき-・un:c・伊東歌詞太郎・コニー・はしやん)",
        genre: "niconicoボーカロイド",
        notes: [{ lv: 6 }, { lv: 8.2 }, { lv: 10.7 }, { lv: 12.5 }],
    },
];

describe("song ID matching", () => {
    test("matches the original Link to AquaDX id 131", () => {
        const song = createSong({
            title: "Link",
            artist: "Clean Tears feat. Youna",
            category: "maimai",
            bpm: 132,
            sheets: createSheets([6, 7.6, 12.6, 12.5, 13.5]),
        });

        expect(matchSongIDFromCandidates(song, linkCandidates)).toBe(131);
    });

    test("matches the vocaloid Link to AquaDX id 383", () => {
        const song = createSong({
            songId: "Link (2)",
            title: "Link",
            artist: "Circle of friends(天月-あまつき-・un:c・伊東歌詞太郎・コニー・はしやん)",
            category: "niconico＆ボーカロイド",
            bpm: 198,
            sheets: createSheets([6, 8, 10.6, 12.5]),
        });

        expect(matchSongIDFromCandidates(song, linkCandidates)).toBe(383);
    });

    test("tolerates category and genre symbol differences", () => {
        expect(stringSimilarity("niconico＆ボーカロイド", "niconicoボーカロイド")).toBe(1);
    });

    test("tolerates light artist and composer punctuation differences", () => {
        expect(stringSimilarity("Clean Tears feat. Youna", "Clean Tears feat Youna")).toBeGreaterThan(0.9);
    });

    test("keeps the old single-candidate behavior", () => {
        const song = createSong({
            title: "Only Song",
            artist: "A",
            category: "maimai",
            sheets: createSheets([1]),
        });

        expect(matchSongIDFromCandidates(song, [{ id: "100042", name: "Only Song" }])).toBe(100042);
    });

    test("throws a diagnostic error when same-title candidates remain ambiguous", () => {
        const song = createSong({
            title: "Mirror",
            artist: "Shared Artist",
            category: "maimai",
            sheets: createSheets([7, 8]),
        });
        const candidates: SongIDCandidate[] = [
            { id: "10", name: "Mirror", composer: "Shared Artist", genre: "maimai", notes: [{ lv: 7 }, { lv: 8 }] },
            { id: "11", name: "Mirror", composer: "Shared Artist", genre: "maimai", notes: [{ lv: 7 }, { lv: 8 }] },
        ];

        expect(() => matchSongIDFromCandidates(song, candidates)).toThrow(/Mirror.*10:Mirror.*11:Mirror/);
    });

    test("does not treat same normalized ids as ambiguous", () => {
        const song = createSong({
            title: "君の知らない物語",
            artist: "supercell「化物語」",
            category: "POPS＆アニメ",
            sheets: createSheets([2, 5, 7, 10]),
        });
        const candidates: SongIDCandidate[] = [
            { id: "10181", name: "君の知らない物語", composer: "supercell", genre: "POPSアニメ", notes: [{ lv: 2 }, { lv: 5 }, { lv: 7 }, { lv: 10 }] },
            { id: "181", name: "君の知らない物語", composer: "supercell", genre: "POPSアニメ", notes: [{ lv: 2 }, { lv: 5 }, { lv: 7 }, { lv: 10 }] },
        ];

        expect(matchSongIDFromCandidates(song, candidates)).toBe(181);
    });

    test("uses zero-level utage songId suffix to select the variant id", () => {
        const song = createSong({
            songId: "(宴) Wonderland Wars オープニング (EXPERT)",
            title: "Wonderland Wars オープニング",
            artist: "「童話」は、全て「戦記」だった",
            category: "宴会場",
            sheets: createSheets([0]),
        });
        const candidates: SongIDCandidate[] = [
            { id: "200429", name: "[宴]Wonderland Wars オープニング", composer: song.artist, genre: "宴会場", notes: [{ lv: 0 }] },
            { id: "300429", name: "[宴]Wonderland Wars オープニング", composer: song.artist, genre: "宴会場", notes: [{ lv: 0 }] },
            { id: "500429", name: "[宴]Wonderland Wars オープニング", composer: song.artist, genre: "宴会場", notes: [{ lv: 0 }] },
        ];

        expect(matchSongIDFromCandidates(song, candidates)).toBe(500429);
    });

    test("prefers raw title matches before scoring normalized-title neighbors", () => {
        const song = createSong({
            title: "[宴]Wonderland Wars　オープニング",
            artist: "「童話」は、全て「戦記」だった",
            category: "宴会場",
            sheets: createSheets([13]),
        });
        const candidates: SongIDCandidate[] = [
            { id: "100429", name: "[宴]Wonderland Wars オープニング", composer: song.artist, genre: "宴会場", notes: [{ lv: 13 }] },
            { id: "140429", name: "[宴]Wonderland Wars　オープニング", composer: song.artist, genre: "宴会場", notes: [{ lv: 13 }] },
        ];

        expect(matchSongIDFromCandidates(song, candidates)).toBe(140429);
    });

    test("scores a close identity match higher than a title-only neighbor", () => {
        const song = createSong({
            title: "Link",
            artist: "Circle of friends(天月-あまつき-・un:c・伊東歌詞太郎・コニー・はしやん)",
            category: "niconico＆ボーカロイド",
            sheets: createSheets([6, 8, 10.6, 12.5]),
        });

        expect(scoreCandidate(song, linkCandidates[1])).toBeGreaterThan(scoreCandidate(song, linkCandidates[0]));
    });
});
