# Graph Report - cloudtak-plugin-measure  (2026-10-27)

## Corpus Check
- 26 files · ~11,527 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 204 nodes · 384 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d66180fa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MeasurePane.vue
- index.ts
- MeasureProfile.vue
- measure-draw.ts
- MeasureDraw
- core-bridge.ts
- package.json
- terrainBasemapId
- check-like-docker.sh

## God Nodes (most connected - your core abstractions)
1. `MeasureDraw` - 24 edges
2. `drawTool()` - 11 edges
3. `cloudtak-plugin-measure` - 9 edges
4. `measure()` - 8 edges
5. `vitest` - 8 edges
6. `renderChart()` - 7 edges
7. `terrainBasemapId()` - 6 edges
8. `populateSnappingLayers()` - 6 edges
9. `close()` - 6 edges
10. `refresh()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Install` --references--> `terrainBasemapId()`  [INFERRED]
  README.md → lib/core-bridge.ts
- `Install` --references--> `measure()`  [INFERRED]
  README.md → lib/geometry.ts
- `Unit tests — run here, standalone` --references--> `terrainBasemapId()`  [INFERRED]
  docs/TESTING.md → lib/core-bridge.ts
- `Keyboard` --references--> `isTypingTarget()`  [INFERRED]
  README.md → lib/geometry.ts
- `Install` --references--> `attachMeasureChrome()`  [INFERRED]
  README.md → lib/toggle-host.ts

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "MeasurePane.vue"
Cohesion: 0.09
Nodes (32): confirmingSave, defaultCallsign, finished, measurement, promptNewMeasurement, redoAvailable, save(), saveError (+24 more)

### Community 1 - "index.ts"
Cohesion: 0.12
Nodes (16): MeasurePlugin, cancelCoreDraw(), mountMeasureToggle(), unmountMeasureToggle(), attachMeasureChrome(), BottomBarLike, detachMeasureChrome(), MEASURE_BOTTOM_BAR_KEY (+8 more)

### Community 2 - "MeasureProfile.vue"
Cohesion: 0.08
Nodes (30): canvasRef, convertDistance(), convertElevation(), destroyChart(), displayDistance(), displayDistanceRaw(), displayElevation(), distanceUnitLabel() (+22 more)

### Community 3 - "measure-draw.ts"
Cohesion: 0.16
Nodes (13): EMPTY_MEASUREMENT, haversineKm(), measure(), Measurement, nearestWithin(), Position, Segment, snapThresholdKm() (+5 more)

### Community 4 - "MeasureDraw"
Cohesion: 0.18
Nodes (3): isTypingTarget(), MeasureDraw, Keyboard

### Community 5 - "core-bridge.ts"
Cohesion: 0.15
Nodes (16): snapOptions, clampGraphZoom(), CORE_STATIC_MODE, CoreDrawTool, coreRoutingGraph(), drawTool(), expandGraphForViewport(), NO_SNAPPING (+8 more)

### Community 7 - "package.json"
Cohesion: 0.12
Nodes (13): comment, description, devDependencies, vitest, license, main, name, scripts (+5 more)

### Community 8 - "terrainBasemapId"
Cohesion: 0.22
Nodes (8): A landmine worth remembering, Lint + typecheck — needs a real directory, Not covered by any automated test, Notes on two assertions that look wrong, Testing, Unit tests — run here, standalone, Why these modules, terrainBasemapId()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MeasureDraw` connect `MeasureDraw` to `MeasurePane.vue`, `index.ts`, `measure-draw.ts`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Should `MeasurePane.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.08636977058029689 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `package.json` to `MeasurePane.vue`, `index.ts`, `MeasureProfile.vue`, `measure-draw.ts`, `core-bridge.ts`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._
- **Why does `terrainBasemapId()` connect `terrainBasemapId` to `index.ts`, `MeasureProfile.vue`, `core-bridge.ts`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `MeasureProfile.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.08130081300813008 - nodes in this community are weakly interconnected._
- **Should `core-bridge.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1471861471861472 - nodes in this community are weakly interconnected._