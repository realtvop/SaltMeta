import type { AvailableRegion, MusicDifficultyID } from "./data";
import type { FitDiffDF } from "./normal";

export type FitDiffDFCompacted = [
    number, // cnt
    string, // diff
    number, // fitDiff
    number, // avg
    number, // avgDx
    number, // stdDev
    number[], // dist
    number[], // fcDist
];

export function compactFitDiffDF(fitDiffDF: FitDiffDF): FitDiffDFCompacted {
    return [
        fitDiffDF.cnt,
        fitDiffDF.diff,
        fitDiffDF.fitDiff,
        fitDiffDF.avg,
        fitDiffDF.avgDx,
        fitDiffDF.stdDev,
        fitDiffDF.dist,
        fitDiffDF.fcDist,
    ];
}

export function expandFitDiffDF(compacted: FitDiffDFCompacted): FitDiffDF {
    const [cnt, diff, fitDiff, avg, avgDx, stdDev, dist, fcDist] = compacted;
    return {
        cnt,
        diff,
        fitDiff,
        avg,
        avgDx,
        stdDev,
        dist,
        fcDist,
    };
}

export type MusicCompacted = [
    number, // id: < 10000, same for sd and dx
    string, // title
    string, // artist
    number, // bpm

    number, // categoryIndex
    boolean, // isLocked

    ChartCompacted[], // charts
    string[] | null, // aliasesCn
]

export type ChartCompacted = [
    number, // type: [sd, dx, utage]
    MusicDifficultyID,
    string, // levelString
    number, // internalLevel
    number, // versionIndex
    [AvailableRegion, string | number][] | null, // regionVersionOverrides

    string, // noteDesigner
    [number, number, number | null, number, number], // noteCounts: [tap, hold, slide, touch, break]

    AvailableRegion[],
]

export type VersionCompacted = [
    string, // version
    string, // word: 一个字简称
    string, // releaseDate
    number | null, // cnVerOverride: 中国版特有的版本名年份
]