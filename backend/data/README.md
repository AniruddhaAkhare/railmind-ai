# Indian Railway Static Network Dataset

This directory contains the static geographic backdrop dataset for Indian Railways used by RailMind AI.

## Datasets

### 1. `indian_railway_stations.json`
Contains 107 major railway stations and junctions across all 18 Indian Railway zones.

#### Schema & Fields
- `id` (string): Station unique identifier / code (e.g. `"NDLS"`).
- `name` (string): Full station name (e.g. `"New Delhi"`).
- `code` (string): Official Indian Railway 3-4 letter station code.
- `latitude` (float): Verified WGS-84 station latitude.
- `longitude` (float): Verified WGS-84 station longitude.
- `type` (string): Station classification (`"major_junction"` vs `"station"`).
- `zone` (string): Zonal Railway (e.g., `"Northern Railway"`, `"Western Railway"`).

### 2. `indian_railway_corridors.json`
Contains 24 major railway trunk lines and regional corridors connecting stations.

#### Schema & Fields
- `id` (string): Corridor identifier (e.g. `"route_001"`).
- `name` (string): Corridor title (e.g. `"Delhi - Mumbai Main Line"`).
- `type` (string): Corridor classification (`"major_corridor"` vs `"regional_corridor"`).
- `stations` (array of strings): Sequential station codes along the corridor.
- `geometry` (array of `[longitude, latitude]` pairs): GeoJSON LineString coordinates.

## Coordinate Convention
> [!IMPORTANT]
> All GeoJSON geometry coordinate pairs in `indian_railway_corridors.json` use standard GeoJSON order: **`[longitude, latitude]`**.
> Station records in `indian_railway_stations.json` expose explicit `latitude` and `longitude` fields.

## Data Source & Scope Note
This is a **static geographic visualization dataset** representing major inter-city corridors between verified stations across India. It provides visual context and alignment for real-time live train markers.

Live train telemetry and positions continue to come exclusively from **RailRadar API** via `LiveRailManager`.

## How to Add New Stations & Corridors
1. **Adding a Station**: Append a dict to `indian_railway_stations.json` with verified latitude, longitude, and station code.
2. **Adding a Corridor**: Append a dict to `indian_railway_corridors.json` with sequential station codes and matching `[longitude, latitude]` coordinates.
