import localData from "../../songidsource/songid.json";
import { fetchMusicIDList, type AquaDXMusicCandidate } from "./aquadx";
import type { Song } from "./arcade-songs/types";

const TITLE_SIMILARITY_THRESHOLD = 0.88;
const ACCEPT_SCORE_THRESHOLD = 0.72;
const ACCEPT_SCORE_MARGIN = 0.08;

export interface SongIDCandidate {
    id: string;
    name: string;
    composer?: string;
    genre?: string;
    bpm?: number;
    notes?: { lv: number }[];
}

interface ScoredCandidate {
    candidate: SongIDCandidate;
    score: number;
}

let songIDsCachePromise: Promise<SongIDCandidate[]> | null = null;

async function getSongIDs(): Promise<SongIDCandidate[]> {
    if (songIDsCachePromise) return songIDsCachePromise;

    songIDsCachePromise = (async () => {
        const mergedMap = new Map<string, SongIDCandidate>();

        const aquadxData = await fetchMusicIDList();
        for (const candidate of aquadxData) {
            mergedMap.set(candidate.id, toSongIDCandidate(candidate));
        }

        for (const [id, value] of Object.entries(localData)) {
            const existing = mergedMap.get(id);
            const name = decodeBase64(value);
            mergedMap.set(id, existing ? { ...existing, name } : { id, name });
        }

        return Array.from(mergedMap.values());
    })();

    return songIDsCachePromise;
}

function toSongIDCandidate(candidate: AquaDXMusicCandidate): SongIDCandidate {
    return {
        id: candidate.id,
        name: candidate.name,
        composer: candidate.composer,
        genre: candidate.genre,
        notes: candidate.notes,
    };
}

export async function matchSongID(song: Song): Promise<number | null> {
    return matchSongIDFromCandidates(song, await getSongIDs());
}

export function matchSongIDFromCandidates(song: Song, candidates: SongIDCandidate[]): number | null {
    const titleMatches = candidates.filter(candidate => normalizeText(candidate.name) === normalizeText(song.title));
    const titleCandidates = titleMatches.length
        ? titleMatches
        : candidates.filter(candidate => stringSimilarity(candidate.name, song.title) >= TITLE_SIMILARITY_THRESHOLD);

    const rawTitleMatches = titleCandidates.filter(candidate => candidate.name === song.title);
    const narrowedTitleCandidates = rawTitleMatches.length ? rawTitleMatches : titleCandidates;

    if (!narrowedTitleCandidates.length) return null;
    const variantCandidates = filterZeroLevelUtageVariantCandidates(song, narrowedTitleCandidates);
    if (variantCandidates.length === 0) return null;
    if (variantCandidates.length === 1) return normalizeId(variantCandidates[0].id);

    const scored = variantCandidates
        .map(candidate => ({ candidate, score: scoreCandidate(song, candidate) }))
        .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && scored.every(candidate => normalizeId(candidate.candidate.id) === normalizeId(best.candidate.id))) {
        return normalizeId(best.candidate.id);
    }

    const second = scored.find(candidate => best && normalizeId(candidate.candidate.id) !== normalizeId(best.candidate.id));
    if (best && best.score >= ACCEPT_SCORE_THRESHOLD && (!second || best.score - second.score >= ACCEPT_SCORE_MARGIN)) {
        return normalizeId(best.candidate.id);
    }

    throw new Error(createAmbiguousMatchMessage(song, scored));
}

function filterZeroLevelUtageVariantCandidates(song: Song, candidates: SongIDCandidate[]): SongIDCandidate[] {
    if (!song.sheets.length || song.sheets.some(sheet => sheet.internalLevelValue !== 0)) return candidates;

    const expectedPrefix = getUtageVariantPrefix(song.songId);
    if (expectedPrefix === null) return candidates;

    const matches = candidates.filter(candidate => {
        const id = Number(candidate.id);
        return id >= 100000 && Math.floor(id / 100000) === expectedPrefix;
    });

    return matches;
}

function getUtageVariantPrefix(songId: string): number | null {
    const suffix = songId.match(/\((easy|basic|advanced|expert|master|re:master)\)\s*$/i)?.[1]?.toLowerCase();
    switch (suffix) {
        case "easy":
            return 2;
        case "basic":
            return 3;
        case "advanced":
            return 4;
        case "expert":
            return 5;
        case "master":
            return 6;
        case "re:master":
            return 7;
        default:
            return null;
    }
}

export function scoreCandidate(song: Song, candidate: SongIDCandidate): number {
    const artistScore = candidate.composer ? stringSimilarity(song.artist, candidate.composer) : 0;
    const categoryScore = candidate.genre ? stringSimilarity(song.category, candidate.genre) : 0;
    const bpmScore = typeof candidate.bpm === "number" ? scoreBpm(song.bpm, candidate.bpm) : 0.5;
    const noteScore = scoreNoteFingerprint(
        song.sheets.map(sheet => sheet.internalLevelValue),
        candidate.notes?.map(note => note.lv) ?? [],
    );

    return artistScore * 0.55
        + categoryScore * 0.20
        + bpmScore * 0.10
        + noteScore * 0.15;
}

function scoreBpm(source: number | null | undefined, target: number | null | undefined): number {
    if (typeof source !== "number" || typeof target !== "number") return 0.5;

    const diff = Math.abs(source - target);
    return Math.max(0, 1 - diff / 20);
}

function scoreNoteFingerprint(source: number[], target: number[]): number {
    if (!source.length || !target.length) return 0;

    const length = Math.max(source.length, target.length);
    let total = 0;

    for (let index = 0; index < length; index++) {
        const sourceLevel = source[index];
        const targetLevel = target[index];
        if (typeof sourceLevel !== "number" || typeof targetLevel !== "number") continue;

        const diff = Math.abs(sourceLevel - targetLevel);
        total += Math.max(0, 1 - diff / 1.5);
    }

    return total / length;
}

export function stringSimilarity(left: unknown, right: unknown): number {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    if (normalizedLeft === normalizedRight) return 1;

    return Math.max(
        levenshteinSimilarity(normalizedLeft, normalizedRight),
        levenshteinSimilarity(compactText(normalizedLeft), compactText(normalizedRight)),
    );
}

function normalizeText(text: unknown): string {
    return String(text ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[＆]/g, "&")
        .replace(/[‐‑‒–—―−ー]/g, "-")
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[・･]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function compactText(text: string): string {
    return text.replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "");
}

function levenshteinSimilarity(left: string, right: string): number {
    if (left === right) return 1;
    if (!left.length || !right.length) return 0;

    const maxLength = Math.max(left.length, right.length);
    return 1 - levenshteinDistance(left, right) / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = Array.from({ length: right.length + 1 }, () => 0);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        current[0] = leftIndex;

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
            const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + cost,
            );
        }

        for (let index = 0; index < previous.length; index++) previous[index] = current[index];
    }

    return previous[right.length];
}

function normalizeId(rawId: string): number {
    const id = Number(rawId);
    return id > 10_0000 ? id : id % 1_0000;
}

function createAmbiguousMatchMessage(song: Song, scored: ScoredCandidate[]): string {
    const candidates = scored
        .map(({ candidate, score }) => `${candidate.id}:${candidate.name}:${score.toFixed(3)}`)
        .join(", ");

    return `Ambiguous song ID match for "${song.title}" by "${song.artist}". Candidates: ${candidates}`;
}

function decodeBase64(base64Str: string): string {
    const binaryString = atob(base64Str);
    return decodeURIComponent(
        Array.from(binaryString)
            .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
            .join(""),
    );
}
