import type { ChartNext, FitDiffDF } from "../../types";

const DF_CHART_STATS_API_URL = "https://www.diving-fish.com/api/maimaidxprober/chart_stats";

type ChartType = ChartNext["type"];
type Difficulty = ChartNext["difficulty"];

export interface DivingFishChartStats {
    chartMetadata: Map<string, FitDiffDF>;
}

interface ChartStatsResponse {
    charts: Record<string, ChartStatsEntry[]>;
}

interface ChartStatsEntry {
    cnt?: number;
    diff?: string;
    fit_diff?: number;
    avg?: number;
    avg_dx?: number;
    std_dev?: number;
    dist?: number[];
    fc_dist?: number[];
}

export function createChartStatsKey(
    musicId: number,
    chartType: ChartType,
    difficulty: Difficulty,
): string {
    return `${musicId}:${chartType}:${difficulty}`;
}

function resolveChartType(rawSongId: number): ChartType | null {
    if (rawSongId >= 100000) return "utage";
    if (rawSongId >= 10000) return "dx";
    return "sd";
}

function resolveMusicId(rawSongId: number, chartType: ChartType): number {
    return chartType === "dx" ? rawSongId % 10000 : rawSongId;
}

function resolveDifficulty(chartType: ChartType, index: number): Difficulty | null {
    if (chartType === "utage") return index === 0 ? (10 as Difficulty) : null;
    return (index >= 0 && index <= 4 ? index : null) as Difficulty | null;
}

function isEmptyEntry(entry: ChartStatsEntry): boolean {
    return entry === null || typeof entry !== "object" || !("fit_diff" in entry) || entry.fit_diff === undefined;
}

function normalizeEntry(entry: ChartStatsEntry): FitDiffDF {
    return {
        cnt: entry.cnt ?? 0,
        diff: entry.diff ?? "",
        fitDiff: entry.fit_diff ?? 0,
        avg: entry.avg ?? 0,
        avgDx: entry.avg_dx ?? 0,
        stdDev: entry.std_dev ?? 0,
        dist: entry.dist ?? [],
        fcDist: entry.fc_dist ?? [],
    };
}

export function convertChartStats(response: ChartStatsResponse): DivingFishChartStats {
    const chartMetadata = new Map<string, FitDiffDF>();

    for (const [rawSongIdStr, entries] of Object.entries(response.charts ?? {})) {
        const rawSongId = Number(rawSongIdStr);
        if (!Number.isFinite(rawSongId)) continue;

        const chartType = resolveChartType(rawSongId);
        if (!chartType) continue;

        const musicId = resolveMusicId(rawSongId, chartType);

        if (!Array.isArray(entries)) continue;
        for (let index = 0; index < entries.length; index++) {
            const entry = entries[index];
            if (!entry || isEmptyEntry(entry)) continue;

            const difficulty = resolveDifficulty(chartType, index);
            if (difficulty === null) continue;

            chartMetadata.set(createChartStatsKey(musicId, chartType, difficulty), normalizeEntry(entry));
        }
    }

    return { chartMetadata };
}

export async function fetchChartStats(): Promise<DivingFishChartStats> {
    const response = await fetch(DF_CHART_STATS_API_URL);
    const data = (await response.json()) as ChartStatsResponse;
    return convertChartStats(data);
}