# Data sources

Every dataset the app ships must be listed here with its URL, publisher, license, and
the date it was retrieved. Seed or placeholder data must be labeled as such in the file
itself and in the app UI.

| Dataset                                          | Publisher                                                                 | URL                                                                  | License                                                                       | Data date                                  | Retrieved | Status                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| Tsunami Evacuation Zones                         | Hawaiʻi Statewide GIS Program (Oʻahu data from City & County of Honolulu) | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/2  | TBD: check metadata (https://files.hawaii.gov/dbedt/op/gis/data/tsunevac.pdf) | April 2025 (per layer description)         | not yet   | Found, not downloaded (M2)                                                               |
| Extreme Tsunami Evacuation Zones                 | Hawaiʻi Statewide GIS Program                                             | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/12 | TBD                                                                           | TBD                                        | not yet   | Found, not downloaded (M2)                                                               |
| Tsunami Evacuation, All Zones (incl. Safe Zones) | Hawaiʻi Statewide GIS Program                                             | https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/11 | TBD                                                                           | TBD (Safe Zones for Oʻahu reportedly 2015) | not yet   | Found, not downloaded (M2)                                                               |
| Emergency shelters / refuge areas                | ?                                                                         | ?                                                                    | ?                                                                             | ?                                          | not yet   | **Not found yet** (M3). Statewide `EmergMgmtPubSafety` service has fire/EMS/police only. |
| Active weather alerts                            | National Weather Service                                                  | https://api.weather.gov/alerts/active?area=HI                        | U.S. Government work, public domain                                           | live                                       | n/a       | M4                                                                                       |
| Oʻahu basemap tiles                              | TBD (likely Protomaps / OpenStreetMap, ODbL)                              | TBD                                                                  | ODbL (attribution required)                                                   | TBD                                        | not yet   | M2                                                                                       |

## Notes

- The development container's network policy blocks `geodata.hawaii.gov` and
  `api.weather.gov`. Fetch scripts must run in CI or on a local machine, or those hosts
  must be allowlisted in the cloud environment settings.
- Shelters open per event. The app must never imply a listed site is currently open.
