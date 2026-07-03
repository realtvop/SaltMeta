const LX_ALIAS_URL = "https://maimai.lxns.net/api/v0/maimai/alias/list";
const YZC_ALIAS_URL = "https://www.yuzuchan.moe/api/maimaidx/maimaidxalias";

interface LXAliasEntry {
    song_id: number;
    aliases: string[];
}

interface LXAliasResponse {
    aliases: LXAliasEntry[];
}

interface YzcAliasEntry {
    SongID: number;
    Alias?: string[];
}

interface YzcAliasResponse {
    content: YzcAliasEntry[];
}

function normalizeId(id: number): number {
    return id > 10_0000 ? id : id % 1_0000;
}

function pushAliases(map: Map<number, string[]>, id: number, aliases: string[] | undefined) {
    if (!aliases?.length) return;
    const target = map.get(id) ?? [];
    const seen = new Set(target);
    for (const raw of aliases) {
        const alias = raw.trim();
        if (!alias || seen.has(alias)) continue;
        seen.add(alias);
        target.push(alias);
    }
    if (target.length) map.set(id, target);
}

export async function fetchChineseAliases(): Promise<Map<number, string[]>> {
    const [lx, yzc] = await Promise.all([
        fetch(LX_ALIAS_URL).then(res => res.json() as Promise<LXAliasResponse>),
        fetch(YZC_ALIAS_URL).then(res => res.json() as Promise<YzcAliasResponse>),
    ]);

    const aliasMap = new Map<number, string[]>();

    for (const entry of yzc.content ?? []) {
        pushAliases(aliasMap, normalizeId(entry.SongID), entry.Alias);
    }

    for (const entry of lx.aliases ?? []) {
        pushAliases(aliasMap, normalizeId(entry.song_id), entry.aliases);
    }

    return aliasMap;
}
