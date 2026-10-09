# Data sources

Every dataset Kōkua ships is listed here. The raw downloads, each source's own metadata
(descriptions, license text, edit dates) and a log of every request
([`data/raw/fetch-log.json`](data/raw/fetch-log.json)) are committed in `data/raw/`, so
each claim below can be checked. All downloads were made on 2026-10-09 by the
`fetch-data.yml` GitHub Actions workflow.

No data in the app is invented. Geometry used only in unit tests is labelled synthetic in
the test files.

## Shipped in the app

| Dataset                                                | Publisher                                                                                      | URL                                                                                                                    | License / terms                                                                                                    | Data date                                   | Retrieved  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ---------- |
| Tsunami Evacuation Zones (layer 2)                     | Hawaiʻi Statewide GIS Program; Oʻahu zones from the City & County of Honolulu                  | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/2                                                    | State of Hawaiʻi Terms of Use: public domain, no warranty (item `db829ab4b17a44649eadf0db0f7379ab`)                | Oʻahu: April 2025. Layer updated 2025-11-20 | 2026-10-09 |
| Extreme Tsunami Evacuation Zones (layer 12)            | Same                                                                                           | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/12                                                   | Same (item `6354a438cc124f3d8d5276035815c948`)                                                                     | Same                                        | 2026-10-09 |
| Tsunami Safe Zones (layer 13)                          | Same                                                                                           | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/13                                                   | Same (item `01ea0d1b26de44438a84581abc0357f8`)                                                                     | Same                                        | 2026-10-09 |
| Potential Oʻahu Hurricane Refuge Areas (38 sites)      | City & County of Honolulu, Department of Emergency Management (ArcGIS Online owner `holisgis`) | https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Potential_Emergency_Shelter_Edit_EOC/FeatureServer/0 | Public item; **no license stated** (item `5dcbab301711462e8cdaf0a3b69436d6`). Government public-safety information | Data last edited 2026-09-08                 | 2026-10-09 |
| Walkable roads and paths on Oʻahu (for walking routes) | OpenStreetMap contributors, via Geofabrik's Hawaiʻi extract                                    | https://download.geofabrik.de/north-america/us/hawaii-latest.osm.pbf                                                   | ODbL, © OpenStreetMap contributors                                                                                 | OSM data as of 2026-10-08                   | 2026-10-09 |
| Active alerts for Hawaiʻi                              | National Weather Service                                                                       | https://api.weather.gov/alerts/active?area=HI                                                                          | U.S. Government work, public domain                                                                                | Live (fetched by the app)                   | Live       |
| Oʻahu basemap (PMTiles, zoom 0–15)                     | Protomaps basemap built from OpenStreetMap                                                     | https://build.protomaps.com/20261009.pmtiles                                                                           | ODbL, © OpenStreetMap contributors (attribution shown on the map)                                                  | OSM data as of 2026-10-09                   | 2026-10-09 |
| Map fonts and sprites                                  | Protomaps `basemaps-assets`                                                                    | https://github.com/protomaps/basemaps-assets                                                                           | Noto fonts under the SIL OFL; see the license in that repository                                                   | n/a                                         | 2026-10-09 |

### Processing

`scripts/data/build.mjs`:

- keeps Oʻahu features only, simplifies polygons to about 2 m with mapshaper
  (`keep-shapes`), and keeps only a `kind` (tsunami / extreme / safe) and an id;
- keeps refuge name, address, place and coordinates. It **drops** the City's `Status`,
  `Open_` and `Close_` edit fields, which have no published meaning: the app must never
  suggest a site is open;
- builds the walking graph (`scripts/data/build-graph.mjs`): keeps ways with a `highway`
  tag that people can walk on (drops motorways and anything tagged `foot`/`access` =
  `no`/`private`), splits them at intersections, keeps the largest connected network,
  simplifies road shapes to ~2 m (lengths are measured before simplifying), tags each
  intersection with its tsunami zone, and links each refuge to its nearest intersection;
- writes `public/data/manifest.json` with publisher, license and dates, which the app
  shows under each dataset.

The app's refuge warning follows the layer's own description: not every site opens,
sites are a last resort, most do not meet State hurricane shelter guidelines, and there
are no supplies.

## Used only in tests

| Dataset                                                                                                                                                                       | Use                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Past 25 NWS alerts for Hawaiʻi, a real response from https://api.weather.gov/alerts?area=HI&limit=25 downloaded 2026-10-09, frozen as `tests/fixtures/nws-hi-2026-10-09.json` | Parser unit tests; served to the app in e2e tests in place of the live feed |

## Checked and not used

| Source                                                                                | Why not                                                                                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| City & County of Honolulu "Emergency Shelter" (data.honolulu.gov `gxrb-rbvm`)         | Based on 2012 data; the row API returned HTTP 403                                                                      |
| HIFLD National Shelter System (NASA NCCS mirror)                                      | Host unreachable from the runner                                                                                       |
| Honolulu GIS download site (gisftp.hicentral.com)                                     | Unreachable                                                                                                            |
| State `EmergMgmtPubSafety`, `HumanHealthSafety`, `Infrastructure`, `Society` services | No shelter or refuge layers                                                                                            |
| OpenStreetMap via the Overpass API                                                    | Both public servers returned HTTP 500 for an Oʻahu-wide query; used Geofabrik instead                                  |
| HIEMA ArcGIS Online services                                                          | Copies of the tsunami zones and siren layers; no shelter layer                                                         |
| `DouglasShelters` (Honolulu org)                                                      | An internal staging layer for planned openings ("so we don't have to touch the live public data"), not public guidance |
