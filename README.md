# maimai Music Metadata

English | [中文](./README.CN.md)

maimai DX music metadata and cover images.

## Usage

### npm (ESM/CJS)

```bash
npm install maimai_music_metadata
```

```ts
import { loadFullMetadata, convertCompactedToNormal, compactMusicMetadata } from "maimai_music_metadata";

// Fetch the hosted compacted metadata and expand it to the normal shape with full typings
const metadata = await loadFullMetadata();

// Or convert a local compacted payload
const normal = convertCompactedToNormal(compactedPayload);

// Convert back to the compacted representation when you need to save bandwidth
const compacted = compactMusicMetadata(normal);

// Opt in to the next metadata shape with per-region chart data
const nextMetadata = await loadFullMetadata({ format: "next" });
```

### Browser `<script>` tag

Use the prebuilt IIFE bundle (global name `MaimaiMetadata`).

```html
<script src="https://unpkg.com/maimai_music_metadata/dist/index.js"></script>
<script>
    (async () => {
        const metadata = await MaimaiMetadata.loadFullMetadata();
        console.log(metadata.musics.length);
    })();
</script>
```

## Table of Contents

- [File Types](#file-types)
  - [meta.json / meta.unformatted.json](#metajson--metaunformattedjson)
  - [meta.compacted.json](#metacompactedjson)
  - [meta.next.json / meta.next.unformatted.json](#metanextjson--metanextunformattedjson)
  - [meta.next.compacted.json](#metanextcompactedjson)
- [Cover Images](#cover-images)
- [Data Structure](#data-structure)
  - [Enums & Constants](#enums--constants)
  - [Normal Format](#normal-format)
    - [Music](#music)
    - [Chart](#chart)
    - [Version](#version)
  - [Next Normal Format](#next-normal-format)
    - [MusicNext](#musicnext)
    - [ChartNext](#chartnext)
    - [ChartRegionData](#chartregiondata)
  - [Compacted Format](#compacted-format)
    - [MusicCompacted](#musiccompacted)
    - [ChartCompacted](#chartcompacted)
    - [VersionCompacted](#versioncompacted)

## File Types

### meta.json / meta.unformatted.json

URL: `https://meta.salt.realtvop.top/meta.json` `https://meta.salt.realtvop.top/meta.unformatted.json`

```typescript
export interface MusicMetadata {
    musics: Music[];
    versions: Version[];
}
```

### meta.compacted.json

URL: `https://meta.salt.realtvop.top/meta.compacted.json`

```typescript
export interface MusicMetadataCompacted {
    musics: MusicCompacted[];
    versions: VersionCompacted[];
}
```

### meta.next.json / meta.next.unformatted.json

URL: `https://meta.salt.realtvop.top/meta.next.json` `https://meta.salt.realtvop.top/meta.next.unformatted.json`

These files use the next format. Each chart stores region-specific `level`, `internalLevel`, and `version`. The npm loader uses the legacy compacted URL by default; pass `{ format: "next" }` to load this shape.

```typescript
export interface MusicMetadataNext {
    musics: MusicNext[];
    versions: Version[];
}
```

### meta.next.compacted.json

URL: `https://meta.salt.realtvop.top/meta.next.compacted.json`

```typescript
export interface MusicMetadataNextCompacted {
    musics: MusicNextCompacted[];
    versions: VersionCompacted[];
}
```

## Cover Images

```typescript
const getImageUrl = (id: string | number) => `http://meta.salt.realtvop.top/covers/00${id.toString().padStart(6, '0').substring(2)}.png`;
```

## Data Structure

### Enums & Constants

#### MusicDifficultyID

| Value | Difficulty |
| :--- | :--- |
| 0 | Basic |
| 1 | Advanced |
| 2 | Expert |
| 3 | Master |
| 4 | ReMaster |
| 10 | Utage |

#### AvailableRegion

| Value | Region |
| :--- | :--- |
| "jp" | Japan |
| "intl" | International |
| "cn" | China |
| "us" | USA |

#### Categories

```typescript
export const categories: string[] = [
    "POPS＆アニメ",
    "niconico＆ボーカロイド",
    "東方Project",
    "ゲーム＆バラエティ",
    "maimai",
    "オンゲキ＆CHUNITHM",
    "宴会場",
];
```

### Normal Format

Corresponds to `meta.json` and `meta.unformatted.json`.

#### Music

```typescript
interface Music {
    id: number;       // < 10000, same for sd and dx
    title: string;
    artist: string;
    bpm: number;

    aliases?: {
        cn: string[]; // Chinese aliases
    };

    category: string; // String from Categories
    isLocked: boolean; // Needs unlocking

    charts: Chart[];
}
```

#### Chart

```typescript
interface Chart {
    type: "sd" | "dx" | "utage";
    difficulty: MusicDifficultyID;
    level: string; // Display level, e.g. "14+"
    internalLevel: number; // Internal level value
    version: string; // Version name
    regionVersionOverride?: Partial<Record<AvailableRegion, string | number>>; // Region-specific version overrides when different from `version`

    noteDesigner: string;
    noteCounts: {
        tap: number;
        hold: number;
        slide: number;
        touch: number | null; // null for standard (sd) charts
        break: number;
        total: number;
    };

    availableRegions: AvailableRegion[];
}
```

#### Version

```typescript
interface Version {
    version: string; // Full version name
    word: string; // One-character abbreviation
    releaseDate: string; // YYYY-MM-DD
    cnVerOverride: number | null; // Year for Chinese version specific naming
}
```

### Next Normal Format

Corresponds to `meta.next.json` and `meta.next.unformatted.json`.

#### MusicNext

```typescript
interface MusicNext {
    id: number;
    title: string;
    artist: string;
    bpm: number;
    aliases?: {
        cn: string[];
    };
    category: string;
    isLocked: boolean;
    charts: ChartNext[];
}
```

#### ChartNext

```typescript
interface ChartNext {
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
    regions: Partial<Record<AvailableRegion, ChartRegionData | null>>;
}
```

Generated next files omit unavailable regions. Consumers may treat a missing region or an explicit `null` value as unavailable.

#### ChartRegionData

```typescript
interface ChartRegionData {
    level: string;
    internalLevel: number;
    version: string | number;
}
```

`version` is usually a version name string. China (`cn`) may use a numeric version year, matching the legacy `regionVersionOverride.cn` behavior.

### Compacted Format

Corresponds to `meta.compacted.json`. Uses arrays to store data for smaller file size.

#### MusicCompacted

```typescript
type MusicCompacted = [
    number, // 0. id
    string, // 1. title
    string, // 2. artist
    number, // 3. bpm

    number, // 4. categoryIndex (index in categories array)
    boolean, // 5. isLocked

    ChartCompacted[], // 6. charts
    string[] | null, // 7. aliasesCn
]
```

#### ChartCompacted

```typescript
type ChartCompacted = [
    number, // 0. type: 0=sd, 1=dx, 2=utage
    MusicDifficultyID, // 1. difficulty
    string, // 2. levelString
    number, // 3. internalLevel
    number, // 4. versionIndex (index in versions array)
    [AvailableRegion, string | number][] | null, // 5. regionVersionOverrides as [region, overrideVersion]

    string, // 6. noteDesigner
    [number, number, number | null, number, number], // 7. noteCounts: [tap, hold, slide, touch, break]

    AvailableRegion[], // 8. availableRegions
]
```

#### MusicNextCompacted

```typescript
type MusicNextCompacted = [
    number, // 0. id
    string, // 1. title
    string, // 2. artist
    number, // 3. bpm
    number, // 4. categoryIndex
    boolean, // 5. isLocked
    ChartNextCompacted[], // 6. charts
    string[] | null, // 7. aliasesCn
]
```

#### ChartNextCompacted

```typescript
type ChartNextCompacted = [
    number, // 0. type: 0=sd, 1=dx, 2=utage
    MusicDifficultyID, // 1. difficulty
    [AvailableRegion, string, number, number | ["raw", string | number]][], // 2. regions: [region, level, internalLevel, versionRef]
    string, // 3. noteDesigner
    [number, number, number | null, number, number], // 4. noteCounts: [tap, hold, slide, touch, break]
]
```

In next compacted data, `versionRef` is a version index when it is a number. Raw numeric versions and unknown version strings are stored as `["raw", value]` to avoid ambiguity.

#### VersionCompacted

```typescript
type VersionCompacted = [
    string, // 0. version
    string, // 1. word
    string, // 2. releaseDate
    number | null, // 3. cnVerOverride
]
```
