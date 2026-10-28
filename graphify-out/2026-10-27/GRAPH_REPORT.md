# Graph Report - cloudtak-plugin-measure  (2026-10-26)

## Corpus Check
- 23 files · ~11,120 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 200 nodes · 372 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3b30ce3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MeasurePane.vue
- index.ts
- MeasureProfile.vue
- measure-draw.ts
- MeasureDraw
- core-bridge.ts
- elevation.ts
- package.json
- Testing
- check-like-docker.sh

## God Nodes (most connected - your core abstractions)
1. `MeasureDraw` - 24 edges
2. `drawTool()` - 11 edges
3. `cloudtak-plugin-measure` - 9 edges
4. `measure()` - 8 edges
5. `renderChart()` - 7 edges
6. `populateSnappingLayers()` - 6 edges
7. `close()` - 6 edges
8. `vitest` - 6 edges
9. `MeasurePlugin` - 5 edges
10. `resetSnappingLayer()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Install` --references--> `measure()`  [INFERRED]
  README.md → lib/geometry.ts
- `Keyboard` --references--> `isTypingTarget()`  [INFERRED]
  README.md → lib/geometry.ts
- `Install` --references--> `attachMeasureChrome()`  [INFERRED]
  README.md → lib/toggle-host.ts
- `stats` --calls--> `profileStats`  [EXTRACTED]
  components/MeasureProfile.vue → lib/profile-stats.ts
- `refresh()` --calls--> `loadProfile()`  [EXTRACTED]
  components/MeasureProfile.vue → lib/elevation.ts

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "MeasurePane.vue"
Cohesion: 0.08
Nodes (34): confirmingSave, defaultCallsign, finished, measurement, promptNewMeasurement, redoAvailable, save(), saveError (+26 more)

### Community 1 - "index.ts"
Cohesion: 0.11
Nodes (16): MeasurePlugin, cancelCoreDraw(), mountMeasureToggle(), unmountMeasureToggle(), attachMeasureChrome(), BottomBarLike, detachMeasureChrome(), MEASURE_BOTTOM_BAR_KEY (+8 more)

### Community 2 - "MeasureProfile.vue"
Cohesion: 0.11
Nodes (23): canvasRef, convertDistance(), convertElevation(), destroyChart(), displayDistance(), displayDistanceRaw(), displayElevation(), distanceUnitLabel() (+15 more)

### Community 3 - "measure-draw.ts"
Cohesion: 0.15
Nodes (13): EMPTY_MEASUREMENT, haversineKm(), measure(), nearestWithin(), Position, Segment, snapThresholdKm(), trueBearing() (+5 more)

### Community 4 - "MeasureDraw"
Cohesion: 0.16
Nodes (5): snapPoints(), isTypingTarget(), Measurement, MeasureDraw, Keyboard

### Community 5 - "core-bridge.ts"
Cohesion: 0.16
Nodes (13): snapOptions, clampGraphZoom(), CORE_STATIC_MODE, CoreDrawTool, coreRoutingGraph(), drawTool(), expandGraphForViewport(), NO_SNAPPING (+5 more)

### Community 6 - "elevation.ts"
Cohesion: 0.26
Nodes (7): stats, loadProfile(), tilesURL(), ElevationProfile, ElevationSample, formatElevation(), profileStats

### Community 7 - "package.json"
Cohesion: 0.15
Nodes (12): comment, description, devDependencies, vitest, license, main, name, scripts (+4 more)

### Community 8 - "Testing"
Cohesion: 0.25
Nodes (7): A landmine worth remembering, Lint + typecheck — needs a real directory, Not covered by any automated test, Notes on two assertions that look wrong, Testing, Unit tests — run here, standalone, Why only those three

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MeasureDraw` connect `MeasureDraw` to `MeasurePane.vue`, `index.ts`, `measure-draw.ts`, `core-bridge.ts`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Should `MeasurePane.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.08170731707317073 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `measure-draw.ts` to `MeasurePane.vue`, `index.ts`, `elevation.ts`, `package.json`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11083743842364532 - nodes in this community are weakly interconnected._
- **Why does `cloudtak-plugin-measure` connect `index.ts` to `MeasureDraw`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `MeasureProfile.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._