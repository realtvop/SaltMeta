# maimai Music Metadata

[English](./README.md) | 中文

maimai DX 歌曲元数据和封面图片。

## 目录

- [文件类型](#文件类型)
  - [meta.json / meta.unformatted.json](#metajson--metaunformattedjson)
  - [meta.compacted.json](#metacompactedjson)
  - [meta.next.json / meta.next.unformatted.json](#metanextjson--metanextunformattedjson)
  - [meta.next.compacted.json](#metanextcompactedjson)
- [封面图片](#封面图片)
- [数据结构](#数据结构)
  - [枚举与常量](#枚举与常量)
  - [普通格式](#普通格式)
    - [Music](#music)
    - [Chart](#chart)
    - [Version](#version)
  - [Next 普通格式](#next-普通格式)
    - [MusicNext](#musicnext)
    - [ChartNext](#chartnext)
    - [ChartRegionData](#chartregiondata)
    - [FitDiffDF](#fitdiffdf)
  - [压缩格式](#压缩格式)
    - [MusicCompacted](#musiccompacted)
    - [ChartCompacted](#chartcompacted)
    - [VersionCompacted](#versioncompacted)

## 文件类型

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

这些文件使用 next 格式。每个谱面都可以为每个地区保存不同的 `level`、`internalLevel` 和 `version`。npm 加载器默认仍然使用旧的压缩 URL；传入 `{ format: "next" }` 才会加载 next 结构。

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

## 封面图片

```typescript
const getImageUrl = (id: string | number) => `http://meta.salt.realtvop.top/covers/00${id.toString().padStart(6, '0').substring(2)}.png`;
```

## 数据结构

### 枚举与常量

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

### 普通格式

对应 `meta.json` 和 `meta.unformatted.json`。

#### Music

```typescript
interface Music {
    id: number;       // < 10000，sd 和 dx 相同
    title: string;
    artist: string;
    bpm: number;

    aliases?: {
        cn: string[]; // 中文别名
    };

    category: string; // 对应 Categories 中的字符串
    isLocked: boolean; // 是否需要解锁

    charts: Chart[];
}
```

#### Chart

```typescript
interface Chart {
    type: "sd" | "dx" | "utage";
    difficulty: MusicDifficultyID;
    level: string; // 显示等级，如 "14+"
    internalLevel: number; // 内部定数
    version: string; // 版本名称
    regionVersionOverride?: Partial<Record<AvailableRegion, string | number>>; // 当某区域与 version 不一致时的覆盖表

    noteDesigner: string;
    noteCounts: {
        tap: number;
        hold: number;
        slide: number;
        touch: number | null; // 标准谱面 (sd) 为 null
        break: number;
        total: number;
    };

    availableRegions: AvailableRegion[];
}
```

#### Version

```typescript
interface Version {
    version: string; // 版本全名
    word: string; // 一个字简称
    releaseDate: string; // 发布日期 YYYY-MM-DD
    cnVerOverride: number | null; // 中国版特有的版本名年份
}
```

### Next 普通格式

对应 `meta.next.json` 和 `meta.next.unformatted.json`。

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
    fitDiffDF?: FitDiffDF; // 来自 diving-fish chart_stats 的拟合难度统计（仅 next 格式）
}
```

生成出的 next 文件会省略不可用地区。消费方可以把缺失地区或显式 `null` 都视为不可用。

#### ChartRegionData

```typescript
interface ChartRegionData {
    level: string;
    internalLevel: number;
    version: string | number;
}
```

`version` 通常是版本名字符串。国服 (`cn`) 可以使用数字年份，语义与旧格式的 `regionVersionOverride.cn` 一致。

#### FitDiffDF

每个谱面的拟合难度统计数据，来源于 diving-fish 的 [`/chart_stats`](https://www.diving-fish.com/api/maimaidxprober/chart_stats) 接口。仅 next 格式会携带该字段，旧格式谱面不包含。字段名由 diving-fish 返回的 snake_case 转为 camelCase。

```typescript
interface FitDiffDF {
    cnt: number;      // 样本数量
    diff: string;     // 官标难度等级，如 "14+"
    fitDiff: number;  // 拟合难度
    avg: number;      // 平均达成率
    avgDx: number;     // 平均 DX 分数
    stdDev: number;    // 达成率标准差
    dist: number[];    // 评级分布：d, c, b, bb, bbb, a, aa, aaa, s, sp, ss, ssp, sss, sssp
    fcDist: number[];  // Full Combo 分布：非、fc、fcp、ap、app
}
```

### 压缩格式

对应 `meta.compacted.json`。为了减小文件体积，使用数组存储数据。

#### MusicCompacted

```typescript
type MusicCompacted = [
    number, // 0. id
    string, // 1. 标题
    string, // 2. 艺术家
    number, // 3. bpm

    number, // 4. 分类索引 (categories 数组中的索引)
    boolean, // 5. 是否锁定

    ChartCompacted[], // 6. 谱面列表
    string[] | null, // 7. 中文别名
]
```

#### ChartCompacted

```typescript
type ChartCompacted = [
    number, // 0. 类型: 0=sd, 1=dx, 2=utage
    MusicDifficultyID, // 1. 难度
    string, // 2. 等级字符串
    number, // 3. 内部定数
    number, // 4. 版本索引 (versions 数组中的索引)
    [AvailableRegion, string | number][] | null, // 5. 区域版本覆盖 [region, overrideVersion]

    string, // 6. 谱面设计者
    [number, number, number | null, number, number], // 7. 物量: [tap, hold, slide, touch, break]

    AvailableRegion[], // 8. 可用区域
]
```

#### MusicNextCompacted

```typescript
type MusicNextCompacted = [
    number, // 0. id
    string, // 1. 标题
    string, // 2. 艺术家
    number, // 3. bpm
    number, // 4. 分类索引
    boolean, // 5. 是否锁定
    ChartNextCompacted[], // 6. 谱面列表
    string[] | null, // 7. 中文别名
]
```

#### ChartNextCompacted

```typescript
type ChartNextCompacted = [
    number, // 0. 类型: 0=sd, 1=dx, 2=utage
    MusicDifficultyID, // 1. 难度
    [AvailableRegion, string, number, number | ["raw", string | number]][], // 2. 地区: [region, level, internalLevel, versionRef]
    string, // 3. 谱面设计者
    [number, number, number | null, number, number], // 4. 物量: [tap, hold, slide, touch, break]
    FitDiffDFCompacted | null, // 5. fitDiffDF: 当 diving-fish 没有该谱面数据时为 null
]
```

#### FitDiffDFCompacted

```typescript
type FitDiffDFCompacted = [
    number, // 0. cnt
    string, // 1. diff
    number, // 2. fitDiff
    number, // 3. avg
    number, // 4. avgDx
    number, // 5. stdDev
    number[], // 6. dist
    number[], // 7. fcDist
]
```

在 next 压缩数据中，`versionRef` 为数字时表示版本索引。原始数字版本和无法匹配版本表的字符串会保存为 `["raw", value]`，避免与版本索引产生歧义。

#### VersionCompacted

```typescript
type VersionCompacted = [
    string, // 0. 版本全名
    string, // 1. 简称
    string, // 2. 发布日期
    number | null, // 3. 国服版本
]
```
