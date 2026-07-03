type ResponseData = Record<string, Music>;

interface Music {
    name: string;
    ver: string;
    composer: string;
    genre: string;
    notes: { lv: number; }[];
}

export interface AquaDXMusicCandidate {
    id: string;
    name: string;
    composer: string;
    genre: string;
    notes: { lv: number; }[];
}

const MUSIC_DATA_URL = 'https://aquadx.net/d/mai2/00/all-music.json';
export const getImageUrl = (id: string | number) => `http://aquadx.net/d/mai2/music/00${id.toString().padStart(6, '0').substring(2)}.png`;

async function fetchWithRetry(url: string, retries = 2, delayMs = 500): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fetch(url, { tls: { rejectUnauthorized: false } });
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError ?? new Error('Failed to fetch URL');
}

export async function fetchMusicIDList(): Promise<AquaDXMusicCandidate[]> {
    const response = await fetchWithRetry(MUSIC_DATA_URL);
    const data: ResponseData = await response.json() as ResponseData;

    return Object.entries(data).map(([id, music]) => ({
        id,
        name: music.name,
        composer: music.composer,
        genre: music.genre,
        notes: music.notes,
    }));
}
