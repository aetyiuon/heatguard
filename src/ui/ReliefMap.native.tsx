import React from 'react';
import MapView, { Marker, Circle, Polyline, Polygon, WMSTile, Region } from 'react-native-maps';
import { Text, View } from 'react-native';
import { MapProps } from './maps.types';
import { C } from './theme';
// Google Maps style for Android; Apple Maps follows userInterfaceStyle on iOS.
const DARK_STREETS = [
  { elementType: 'geometry', stylers: [{ color: '#18242D' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A3B1BE' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#18242D' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#30404D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102D3D' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1C342F' }] },
];
const colors = { water: '#4587AD', shade: '#53864F', ac: '#D8633E', 'cooling-center': '#7A0E7F' };
const EMPTY_TRAILS: NonNullable<MapProps['trails']> = [];
const EMPTY_REPORTS: NonNullable<MapProps['reports']> = [];
export default function ReliefMap({
  place,
  pins,
  onSelect,
  reports = EMPTY_REPORTS,
  heatLayer = false,
  heatRiskValidTime,
  trails = EMPTY_TRAILS,
  showLabels = true,
  city,
  showParks = true,
  focus,
  viewKey,
  picking = false,
  pickedPoint,
  onPickLocation,
  routePaths,
  routeDashed = false,
}: MapProps) {
  const map = React.useRef<MapView>(null);
  const initialRegion = React.useMemo(() => {
    const b = focus?.bounds ?? city?.bounds;
    return b
      ? {
          latitude: (b[1] + b[3]) / 2,
          longitude: (b[0] + b[2]) / 2,
          latitudeDelta: Math.max(0.008, (b[3] - b[1]) * 1.3),
          longitudeDelta: Math.max(0.008, (b[2] - b[0]) * 1.3),
        }
      : {
          latitude: focus?.latitude ?? place.latitude,
          longitude: focus?.longitude ?? place.longitude,
          latitudeDelta: focus?.latitude ? 0.015 : 0.055,
          longitudeDelta: focus?.longitude ? 0.015 : 0.055,
        };
  }, [city, focus, place.latitude, place.longitude]);
  const [region, setRegion] = React.useState<Region>(initialRegion);
  React.useEffect(() => {
    map.current?.animateToRegion(initialRegion, 300);
    setRegion(initialRegion);
  }, [initialRegion, viewKey]);
  const groups = React.useMemo(() => {
    const result = new Map<string, typeof pins>(),
      coarse = region.latitudeDelta > 0.05;
    for (const p of pins) {
      if (
        Math.abs(p.latitude - region.latitude) > region.latitudeDelta * 0.7 ||
        Math.abs(p.longitude - region.longitude) > region.longitudeDelta * 0.7
      )
        continue;
      const key = coarse
        ? `${Math.floor(p.latitude / (region.latitudeDelta / 9))}:${Math.floor(p.longitude / (region.longitudeDelta / 9))}`
        : p.id;
      const group = result.get(key) ?? [];
      group.push(p);
      result.set(key, group);
    }
    return [...result.values()];
  }, [pins, region]);
  const time = heatRiskValidTime ? Date.parse(heatRiskValidTime) : undefined;
  return (
    <MapView
      ref={map}
      style={{ height: 420, width: '100%' }}
      initialRegion={initialRegion}
      userInterfaceStyle="dark"
      customMapStyle={DARK_STREETS}
      onRegionChangeComplete={setRegion}
      onPress={(event) => {
        if (picking) onPickLocation?.(event.nativeEvent.coordinate);
      }}
      accessibilityLabel="Relief map: water, shade and air-conditioned places"
    >
      {routePaths?.map((path, i) =>
        path.length > 1 ? (
          <Polyline
            key={`journey-${i}`}
            coordinates={path}
            strokeColor={C.green}
            strokeWidth={5}
            lineDashPattern={routeDashed ? [8, 8] : undefined}
          />
        ) : null,
      )}
      {routePaths?.flat().length ? (
        <Marker coordinate={routePaths.flat()[0]!} title="Route start" pinColor={C.green} />
      ) : null}
      {routePaths?.flat().length ? (
        <Marker coordinate={routePaths.flat().at(-1)!} title="Route end" pinColor={C.orange} />
      ) : null}
      {!city ? (
        <Marker coordinate={place} title="Your selected location" pinColor="#223D35" />
      ) : null}
      {pickedPoint ? (
        <Marker
          coordinate={pickedPoint}
          title="Your suggested location · unverified"
          pinColor="#D8842D"
        />
      ) : null}
      {city?.boundary.map(([outer, ...holes], i) =>
        outer ? (
          <Polygon
            key={`city-${i}`}
            coordinates={outer.map(([longitude, latitude]) => ({ latitude, longitude }))}
            holes={holes.map((r) => r.map(([longitude, latitude]) => ({ latitude, longitude })))}
            strokeColor="#7958A5"
            strokeWidth={2}
            fillColor="#7958A504"
          />
        ) : null,
      )}
      {city?.regions?.flatMap((region) =>
        region.polygons.map(([outer, ...holes], i) =>
          outer ? (
            <Polygon
              key={`county-${region.id}-${i}`}
              coordinates={outer.map(([longitude, latitude]) => ({ latitude, longitude }))}
              holes={holes.map((r) => r.map(([longitude, latitude]) => ({ latitude, longitude })))}
              strokeColor="#7B8585"
              strokeWidth={1}
              fillColor="#00000000"
            />
          ) : null,
        ),
      )}
      {showParks
        ? city?.parks.flatMap((park) =>
            park.polygons.map(([outer, ...holes], i) =>
              outer ? (
                <Polygon
                  key={`${park.id}-${i}`}
                  coordinates={outer.map(([longitude, latitude]) => ({ latitude, longitude }))}
                  holes={holes.map((r) =>
                    r.map(([longitude, latitude]) => ({ latitude, longitude })),
                  )}
                  strokeColor="#70906C"
                  strokeWidth={1}
                  fillColor="#8AB07B29"
                  tappable={!picking}
                  onPress={() =>
                    map.current?.animateToRegion(
                      {
                        latitude: outer[0]![1],
                        longitude: outer[0]![0],
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      },
                      300,
                    )
                  }
                />
              ) : null,
            ),
          )
        : null}
      {trails.flatMap((trail) =>
        trail.paths.map((path, i) => (
          <Polyline
            key={`${trail.id}-${i}`}
            coordinates={path.map(([longitude, latitude]) => ({ latitude, longitude }))}
            strokeColor="#477C68"
            strokeWidth={3}
            lineDashPattern={[5, 4]}
          />
        )),
      )}
      {groups.map((group) => {
        const p = group[0]!;
        if (group.length > 1) {
          const coordinate = {
            latitude: group.reduce((s, p) => s + p.latitude, 0) / group.length,
            longitude: group.reduce((s, p) => s + p.longitude, 0) / group.length,
          };
          return (
            <Marker
              key={`cluster-${p.id}`}
              coordinate={coordinate}
              title={`${group.length} mapped places`}
              accessibilityLabel={`${group.length} mapped places; zoom to explore`}
              onPress={() =>
                map.current?.animateToRegion(
                  {
                    ...coordinate,
                    latitudeDelta: region.latitudeDelta * 0.4,
                    longitudeDelta: region.longitudeDelta * 0.4,
                  },
                  300,
                )
              }
            >
              <View
                style={{
                  backgroundColor: '#223D35',
                  borderColor: 'white',
                  borderWidth: 2,
                  borderRadius: 22,
                  padding: 10,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>{group.length}</Text>
              </View>
            </Marker>
          );
        }
        return (
          <Marker
            key={p.id}
            coordinate={p}
            title={p.name}
            accessibilityLabel={p.name}
            description={p.source}
            pinColor={colors[p.kind]}
            onPress={() => onSelect(p)}
          >
            <View style={{ alignItems: 'center', maxWidth: 180 }}>
              {showLabels && region.latitudeDelta < 0.05 ? (
                <Text
                  numberOfLines={1}
                  style={{
                    backgroundColor: C.paper,
                    color: C.ink,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  {p.assetId && p.kind === 'water' ? `Fountain #${p.assetId}` : p.name}
                </Text>
              ) : null}
              <View
                style={{
                  backgroundColor: colors[p.kind],
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: 'white',
                  padding: 5,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                  {p.kind === 'water'
                    ? 'W'
                    : p.kind === 'shade'
                      ? 'S'
                      : p.kind === 'ac'
                        ? 'AC'
                        : '+'}
                </Text>
              </View>
            </View>
          </Marker>
        );
      })}
      {reports.map((r, i) => (
        <Circle
          key={i}
          center={r}
          radius={200}
          fillColor={
            r.feeling === 'very-hot' ? '#E22F3333' : r.feeling === 'hot' ? '#F6963233' : '#4D9B5933'
          }
          strokeWidth={1}
          strokeColor={r.feeling === 'very-hot' ? '#E22F33' : '#F69632'}
        />
      ))}
      {heatLayer && time ? (
        <WMSTile
          urlTemplate={`https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/exportImage?bbox={minX},{minY},{maxX},{maxY}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&time=${time}`}
          tileSize={256}
          opacity={0.35}
        />
      ) : null}
    </MapView>
  );
}
