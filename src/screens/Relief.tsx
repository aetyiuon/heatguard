import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import ReliefMap from '../ui/ReliefMap';
import { Button, Card, Chip, Copy, Field, Icon, Toggle, useLocale } from '../ui/components';
import { C, styles } from '../ui/theme';
import { CityDataset, PinKind, ReliefPin } from '../domain/types';
import {
  directionsUrl,
  rankedRelief,
  usablePin,
  mergePins,
  pickedCoordinates,
  suggestionCoordinates,
} from '../domain/relief';
import { communityWrite } from '../services/api';
import { DFW_PLACES } from '../domain/places';
import { bundledCity, insidePolygons, polygonBounds } from '../domain/cities';
import { MapProps } from '../ui/maps.types';
import { DistrictCoverage } from '../ui/DistrictCoverage';
export function Relief({ s }: { s: HeatGuardState }) {
  const { t } = useLocale();
  const compact = useWindowDimensions().width < 700;
  const [filter, setFilter] = useState<PinKind | 'all'>('all'),
    [view, setView] = useState<'map' | 'list'>('map'),
    [selected, setSelected] = useState<ReliefPin | null>(null),
    [add, setAdd] = useState(false),
    [name, setName] = useState(''),
    [kind, setKind] = useState<PinKind>('water'),
    [share, setShare] = useState(false);
  const [showLabels, setShowLabels] = useState(true),
    [showTrails, setShowTrails] = useState(true),
    [showParks, setShowParks] = useState(true),
    [listLimit, setListLimit] = useState(30);
  const [city, setCity] = useState<CityDataset | undefined>(),
    [cityLoading, setCityLoading] = useState(false),
    [search, setSearch] = useState(''),
    [searchLimit, setSearchLimit] = useState(8),
    [regionFilter, setRegionFilter] = useState('all'),
    [focus, setFocus] = useState<MapProps['focus']>(),
    [viewKey, setViewKey] = useState(0);
  const [lat, setLat] = useState(String(s.place.latitude)),
    [lon, setLon] = useState(String(s.place.longitude));
  const [picking, setPicking] = useState(false),
    [pickedPoint, setPickedPoint] = useState<MapProps['pickedPoint']>();
  useEffect(() => {
    setSelected(null);
    setAdd(false);
    setPicking(false);
    setPickedPoint(undefined);
    setLat(String(s.place.latitude));
    setLon(String(s.place.longitude));
    setListLimit(30);
    if (s.mapScope === 'nearby') void s.loadMap();
  }, [s.place.latitude, s.place.longitude, s.mapScope]);
  useEffect(() => {
    let cancelled = false;
    setSearch('');
    setSearchLimit(8);
    setRegionFilter('all');
    setSelected(null);
    setListLimit(30);
    setCity(undefined);
    if (s.mapScope === 'nearby') {
      setCityLoading(false);
      return;
    }
    setCityLoading(true);
    void bundledCity(s.mapScope)
      .then((data) => {
        if (!cancelled) setCity(data);
      })
      .catch((e) => {
        if (!cancelled) s.setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [s.mapScope]);
  const pins = useMemo(
    () =>
      city
        ? mergePins(
            city.pins,
            s.localPins.filter((p) => insidePolygons(p.longitude, p.latitude, city.boundary)),
          )
        : s.mapScope === 'nearby'
          ? s.pins
          : [],
    [city, s.localPins, s.pins, s.mapScope],
  );
  const query = search.trim().toLowerCase();
  const activeRegion = city?.regions?.find((r) => r.id === regionFilter);
  const localityResults = useMemo(
    () =>
      query ? (city?.localities ?? []).filter((l) => l.name.toLowerCase().includes(query)) : [],
    [city, query],
  );
  const trails = useMemo(() => {
    const all = city?.trails ?? (s.mapScope === 'nearby' ? s.mapTrails : []);
    return activeRegion
      ? all.filter((t) => t.regionName?.split(', ').includes(activeRegion.name))
      : all;
  }, [city, s.mapScope, s.mapTrails, activeRegion]);
  const mapPlace = useMemo(
    () =>
      city
        ? {
            ...s.place,
            name: `${city.name} map`,
            latitude: (city.bounds[1] + city.bounds[3]) / 2,
            longitude: (city.bounds[0] + city.bounds[2]) / 2,
          }
        : s.place,
    [city, s.place],
  );
  const parkResults = useMemo(
    () =>
      query
        ? (city?.parks ?? []).filter(
            (p) =>
              (!activeRegion || p.regionName?.split(', ').includes(activeRegion.name)) &&
              `${p.name} ${p.address ?? ''} ${p.regionName ?? ''} ${p.localityName ?? ''}`
                .toLowerCase()
                .includes(query),
          )
        : [],
    [city, query, activeRegion],
  );
  const trailResults = useMemo(
    () =>
      query
        ? trails.filter((p) =>
            `${p.name} ${p.parkName ?? ''} ${p.regionName ?? ''} ${p.localityName ?? ''}`
              .toLowerCase()
              .includes(query),
          )
        : [],
    [trails, query],
  );
  const filtered = useMemo(
    () =>
      rankedRelief(
        pins.filter(
          (p) =>
            (filter === 'all' || filter === p.kind) &&
            (!activeRegion || insidePolygons(p.longitude, p.latitude, activeRegion.polygons)) &&
            (!query ||
              `${p.name} ${p.parkName ?? ''} ${p.assetId ?? ''} ${p.regionName ?? ''} ${p.localityName ?? ''}`
                .toLowerCase()
                .includes(query)),
        ),
        s.place,
      ),
    [pins, query, filter, s.place.latitude, s.place.longitude, activeRegion],
  );
  const mapPins = useMemo(() => filtered.filter(usablePin), [filtered]);
  const mapLoading = cityLoading || (s.mapScope === 'nearby' && s.mapLoading);
  function explore(p: MapProps['focus']) {
    setFocus(p);
    setView('map');
    setViewKey((v) => v + 1);
  }
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  const labels: Record<PinKind, string> = {
    water: t('Drinking fountains', 'Fuentes de agua potable'),
    shade: t('Shade', 'Sombra'),
    ac: t('Public AC', 'Aire acondicionado'),
    'cooling-center': t('Cooling centers', 'Centros de enfriamiento'),
  };
  async function save() {
    const point = suggestionCoordinates(lat, lon);
    if (!name.trim() || !point)
      throw new Error(
        t('Enter a name and valid coordinates.', 'Ingresa nombre y coordenadas válidas.'),
      );
    const { latitude, longitude } = point;
    if (city && !insidePolygons(longitude, latitude, city.boundary))
      throw new Error(
        t(
          'Choose a point inside the selected map area, or switch areas.',
          'Elige un punto dentro del área seleccionada o cambia de área.',
        ),
      );
    const pin: ReliefPin = {
      id: `local-${Date.now()}`,
      name: name.trim(),
      latitude,
      longitude,
      kind,
      source: 'Local suggestion; not verified',
      provenance: 'community',
      regionName: city?.regions?.find((r) => insidePolygons(longitude, latitude, r.polygons))?.name,
      official: false,
      status: 'unknown',
      updatedAt: new Date().toISOString(),
      confirmations: 0,
      reports: 0,
    };
    await s.savePin(pin);
    setName('');
    setAdd(false);
    setPicking(false);
    setPickedPoint(undefined);
    setSelected(pin);
    setFilter(kind);
    setSearch('');
    setRegionFilter('all');
    explore(pin);
    if (share)
      try {
        await communityWrite('/community/pins', { name: pin.name, latitude, longitude, kind });
      } catch (error) {
        throw new Error(
          t(
            'Saved locally. Public sharing is unavailable.',
            'Guardado localmente. No se pudo compartir.',
          ),
        );
      }
  }
  async function vote(pin: ReliefPin, working: boolean) {
    await s.savePin({
      ...pin,
      status: working ? 'working' : 'not-working',
      updatedAt: new Date().toISOString(),
      source: pin.source + ' · your local report',
    });
    setSelected({ ...pin, status: working ? 'working' : 'not-working' });
    if (
      !pin.id.startsWith('local-') &&
      !pin.id.startsWith('osm-') &&
      !pin.id.startsWith('municipal-')
    )
      await communityWrite('/community/vote', {
        pinId: pin.id,
        latitude: pin.latitude,
        longitude: pin.longitude,
        kind: working ? 'confirm' : 'report',
      });
  }
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 7 }}>
        <Copy kind="label">{t('A COOLER PLACE IS CLOSER', 'UN LUGAR MÁS FRESCO CERCA')}</Copy>
        <Copy kind="title">{t('Relief, within reach.', 'Alivio a tu alcance.')}</Copy>
        <Copy>
          {t(
            'Find water, shade and a place to take a real cooling break.',
            'Encuentra agua, sombra y un lugar donde refrescarte.',
          )}
        </Copy>
      </View>
      <Card style={{ backgroundColor: C.soft }}>
        <Copy kind="label">
          {t('EXPLORE TEXAS DISTRICTS & DFW', 'EXPLORA LOS DISTRITOS DE TEXAS Y DFW')}
        </Copy>
        <Copy style={{ fontSize: 13 }}>
          {t(
            'Browse District 30, District 6, or either city, then zoom into a county, community, park or trail. Your heat-check location stays the same.',
            'Explora los distritos 30 o 6, o una ciudad, y acerca un condado, comunidad, parque o sendero. Tu ubicación para el calor no cambia.',
          )}
        </Copy>
        <View style={styles.wrap}>
          <Chip
            label={t('Texas District 30', 'Distrito 30 de Texas')}
            selected={s.mapScope === 'tx30'}
            onPress={() => {
              setFocus(undefined);
              s.setMapScope('tx30');
              setRegionFilter('all');
              setViewKey((v) => v + 1);
            }}
          />
          <Chip
            label={t('Texas District 6', 'Distrito 6 de Texas')}
            selected={s.mapScope === 'tx06'}
            onPress={() => {
              setFocus(undefined);
              s.setMapScope('tx06');
              setRegionFilter('all');
              setViewKey((v) => v + 1);
            }}
          />
          <Chip
            label={t('Entire Arlington', 'Todo Arlington')}
            selected={s.mapScope === 'arlington'}
            onPress={() => {
              setFocus(undefined);
              s.setMapScope('arlington');
            }}
          />
          <Chip
            label={t('Entire Dallas', 'Todo Dallas')}
            selected={s.mapScope === 'dallas'}
            onPress={() => {
              setFocus(undefined);
              s.setMapScope('dallas');
            }}
          />
          <Chip
            label={t('Near my selected location', 'Cerca de mi ubicación')}
            selected={s.mapScope === 'nearby'}
            onPress={() => {
              setFocus(undefined);
              s.setMapScope('nearby');
            }}
          />
        </View>
        <Field
          label={t('SEARCH PARKS, TRAILS & PLACES', 'BUSCAR PARQUES, SENDEROS Y LUGARES')}
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setSearchLimit(8);
            setListLimit(30);
          }}
          placeholder={
            s.mapScope === 'tx30'
              ? t(
                  'Try Dallas, Cedar Hill, Lancaster, Duncanville…',
                  'Prueba Dallas, Cedar Hill, Lancaster, Duncanville…',
                )
              : t(
                  'Try Waxahachie, Corsicana, Palestine, Cherokee…',
                  'Prueba Waxahachie, Corsicana, Palestine, Cherokee…',
                )
          }
        />
        {query ? (
          <View style={styles.wrap}>
            {localityResults.slice(0, searchLimit).map((l) => (
              <Chip
                key={l.id}
                label={`${l.name} · ${t('Community', 'Comunidad')}`}
                selected={focus?.name === l.name}
                onPress={() => {
                  setRegionFilter('all');
                  explore({
                    name: l.name,
                    latitude: (l.bounds[1] + l.bounds[3]) / 2,
                    longitude: (l.bounds[0] + l.bounds[2]) / 2,
                    bounds: l.bounds,
                  });
                }}
              />
            ))}
            {parkResults.slice(0, searchLimit).map((p) => (
              <Chip
                key={p.id}
                label={`${p.name} · Park`}
                selected={focus?.name === p.name}
                onPress={() => {
                  const b = polygonBounds(p.polygons);
                  explore({
                    name: p.name,
                    longitude: (b[0] + b[2]) / 2,
                    latitude: (b[1] + b[3]) / 2,
                    bounds: b,
                  });
                }}
              />
            ))}
            {trailResults.slice(0, searchLimit).map((p) => (
              <Chip
                key={p.id}
                label={`${p.name} · Trail`}
                selected={focus?.name === p.name}
                onPress={() => {
                  const b = polygonBounds([[p.paths.flat()]]);
                  explore({
                    name: p.name,
                    longitude: (b[0] + b[2]) / 2,
                    latitude: (b[1] + b[3]) / 2,
                    bounds: b,
                  });
                }}
              />
            ))}
            <Copy style={{ fontSize: 12 }}>
              {filtered.length} places · {parkResults.length} park features · {trailResults.length}{' '}
              trail features
            </Copy>
            {parkResults.length > searchLimit ||
            trailResults.length > searchLimit ||
            localityResults.length > searchLimit ? (
              <Button
                variant="secondary"
                label={t('More park / trail matches', 'Más coincidencias')}
                onPress={() => setSearchLimit((v) => v + 8)}
              />
            ) : null}
            <Button
              variant="quiet"
              label={t('Clear search', 'Borrar búsqueda')}
              onPress={() => setSearch('')}
            />
          </View>
        ) : null}
        <ScrollView
          horizontal={compact}
          showsHorizontalScrollIndicator={compact}
          contentContainerStyle={
            compact ? { flexDirection: 'row', gap: 8, paddingBottom: 6 } : styles.wrap
          }
        >
          {DFW_PLACES.map((p) => (
            <Chip
              key={p.name}
              label={p.name}
              selected={focus?.name === p.name}
              onPress={() => {
                const scope = p.name.startsWith('Dallas')
                  ? 'dallas'
                  : p.name.startsWith('Arlington')
                    ? 'arlington'
                    : 'nearby';
                if (scope === 'nearby') {
                  s.setMapScope('nearby');
                  run(() => s.changePlace(p));
                } else {
                  s.setMapScope(scope);
                  explore(p);
                }
              }}
            />
          ))}
        </ScrollView>
      </Card>
      {city?.areaType === 'congressional-district' ? (
        <DistrictCoverage
          data={city}
          selected={regionFilter}
          onReset={() => {
            setRegionFilter('all');
            setFocus(undefined);
            setSearch('');
            setViewKey((v) => v + 1);
          }}
          onSelect={(region) => {
            setRegionFilter(region.id);
            setSearch('');
            explore({
              name: region.name,
              latitude: (region.bounds[1] + region.bounds[3]) / 2,
              longitude: (region.bounds[0] + region.bounds[2]) / 2,
              bounds: region.bounds,
            });
          }}
        />
      ) : null}
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', flexWrap: 'wrap' },
          compact && { flexDirection: 'column', alignItems: 'flex-start' },
        ]}
      >
        <View style={[styles.wrap, { maxWidth: '100%' }]}>
          <Chip
            label={t('All places', 'Todos')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {(Object.keys(labels) as PinKind[]).map((k) => (
            <Chip key={k} label={labels[k]} selected={filter === k} onPress={() => setFilter(k)} />
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip label={t('Map', 'Mapa')} selected={view === 'map'} onPress={() => setView('map')} />
          <Chip
            label={t('List', 'Lista')}
            selected={view === 'list'}
            onPress={() => setView('list')}
          />
        </View>
      </View>
      {view === 'map' ? (
        <View
          style={{
            borderRadius: 26,
            overflow: 'hidden',
            borderWidth: 2,
            borderBottomWidth: 5,
            borderColor: C.line,
          }}
        >
          <ReliefMap
            place={mapPlace}
            pins={mapPins}
            trails={showTrails ? trails : undefined}
            showLabels={showLabels}
            city={city}
            focus={focus}
            viewKey={viewKey}
            showParks={showParks}
            onSelect={setSelected}
            picking={add && picking}
            pickedPoint={add ? pickedPoint : undefined}
            onPickLocation={(value) => {
              const point = pickedCoordinates(value);
              if (!point) return;
              if (city && !insidePolygons(point.longitude, point.latitude, city.boundary)) {
                s.setError(
                  t(
                    'Pick a point inside the selected area.',
                    'Elige un punto dentro del área seleccionada.',
                  ),
                );
                return;
              }
              setLat(point.latitude.toFixed(6));
              setLon(point.longitude.toFixed(6));
              setPickedPoint(point);
              setPicking(false);
              setRegionFilter('all');
              explore({ ...point, name: t('Suggested location', 'Ubicación sugerida') });
            }}
          />
        </View>
      ) : null}
      <View style={styles.wrap}>
        {add ? (
          <Copy>
            {picking
              ? t(
                  'Tap the map to choose the place’s location, or enter coordinates below.',
                  'Toca el mapa para elegir la ubicación o ingresa coordenadas.',
                )
              : t(
                  'Location selected for your unverified suggestion.',
                  'Ubicación seleccionada para tu sugerencia sin verificar.',
                )}
          </Copy>
        ) : null}
        <Copy style={{ fontSize: 12 }} color="#4587AD">
          ● {t('Drinking water', 'Agua potable')}
        </Copy>
        <Copy style={{ fontSize: 12 }} color="#53864F">
          ● {t('Shelter / potential tree shade', 'Refugio / posible sombra de árboles')}
        </Copy>
        <Copy style={{ fontSize: 12 }} color={C.orange}>
          ● {t('Public cooling spaces', 'Espacios públicos frescos')}
        </Copy>
      </View>
      <View style={styles.wrap}>
        <Toggle
          label={t('Show place labels', 'Mostrar nombres')}
          value={showLabels}
          onChange={setShowLabels}
        />
        <Toggle
          label={t('Show mapped trails', 'Mostrar senderos')}
          value={showTrails}
          onChange={setShowTrails}
        />
        {city ? (
          <Toggle
            label={t('Show park boundaries', 'Mostrar límites de parques')}
            value={showParks}
            onChange={setShowParks}
          />
        ) : null}
        {city ? (
          <Button
            variant="secondary"
            label={
              city.areaType === 'congressional-district'
                ? t('Show entire district', 'Mostrar todo el distrito')
                : t('Show entire city', 'Mostrar toda la ciudad')
            }
            onPress={() => {
              setFocus(undefined);
              setRegionFilter('all');
              setSearch('');
              setView('map');
              setViewKey((v) => v + 1);
            }}
          />
        ) : null}
      </View>
      {city ? (
        <Card>
          <Copy kind="h2">
            {city.name} ·{' '}
            {city.areaType === 'congressional-district'
              ? t('district-wide data', 'datos de todo el distrito')
              : t('whole-city coverage', 'cobertura de toda la ciudad')}
          </Copy>
          <Copy>
            {city.pins.filter((p) => p.kind === 'water').length}{' '}
            {t('mapped fountains', 'fuentes registradas')} ·{' '}
            {city.pins.filter((p) => p.kind === 'shade').length}{' '}
            {t('shelters / wooded areas', 'refugios / áreas arboladas')} · {city.parks.length}{' '}
            {t('park features', 'elementos de parques')} · {city.trails.length}{' '}
            {t('trail segments', 'tramos de sendero')}
          </Copy>
          <Copy style={{ fontSize: 12 }}>
            {t(
              'Published records across this area, collected ',
              'Registros publicados de esta área, recopilados ',
            )}
            {new Date(city.fetchedAt).toLocaleDateString()}. {city.warnings[0]}
          </Copy>
          {city.sources
            .filter((source) => source.name.includes('(database '))
            .map((source) => (
              <Copy key={source.url} style={{ fontSize: 12 }}>
                {source.name}
              </Copy>
            ))}
          <Button
            variant="quiet"
            label={t('Boundary source ↗', 'Fuente de límites ↗')}
            onPress={() => void Linking.openURL(city.boundarySource)}
          />
          {city.sources
            .filter((source) => source.url !== city.boundarySource)
            .map((source) => (
              <Button
                key={source.url}
                variant="quiet"
                label={`${source.name.split(' (')[0]} ↗`}
                onPress={() => void Linking.openURL(source.url)}
              />
            ))}
        </Card>
      ) : null}
      <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
        <Copy style={{ fontSize: 12 }}>
          {filtered.length}{' '}
          {t(
            'mapped places · confirm hours before walking',
            'lugares · confirma el horario antes de caminar',
          )}
          {city
            ? t(' · bundled area data', ' · datos del área incluidos')
            : s.mapCached
              ? t(' · offline cache', ' · datos sin conexión')
              : ''}
        </Copy>
        <View style={styles.wrap}>
          <Button
            variant="secondary"
            icon="refresh"
            disabled={mapLoading}
            label={
              mapLoading
                ? t('Finding places…', 'Buscando…')
                : city
                  ? t('Reset area map', 'Restablecer mapa')
                  : t('Refresh places', 'Actualizar lugares')
            }
            onPress={() =>
              city
                ? (setFocus(undefined),
                  setRegionFilter('all'),
                  setSearch(''),
                  setViewKey((v) => v + 1))
                : void s.loadMap()
            }
          />
          <Button
            icon="pin"
            label={t('Suggest a place', 'Sugerir un lugar')}
            disabled={cityLoading}
            onPress={() => {
              setAdd(!add);
              setPicking(!add);
              setPickedPoint(undefined);
              if (!add) {
                setLat('');
                setLon('');
                setView('map');
              }
            }}
          />
        </View>
      </View>
      <Copy style={{ fontSize: 12 }}>
        {t('Distances from ', 'Distancias desde ')}
        {s.place.name}
        {t(' · selected heat-check location', ' · ubicación seleccionada para el calor')}
      </Copy>
      {add ? (
        <Card>
          <Copy kind="h2">{t('Add a useful place', 'Agregar un lugar útil')}</Copy>
          <Copy>
            {t(
              'Saved locally by default. Suggestions are never labeled official cooling centers.',
              'Se guarda localmente. Las sugerencias no se marcan como centros oficiales.',
            )}
          </Copy>
          <Field label={t('PLACE NAME', 'NOMBRE')} value={name} onChangeText={setName} />
          <Button
            variant="secondary"
            label={t('Pick location on map', 'Elegir ubicación en el mapa')}
            onPress={() => {
              setView('map');
              setPicking(true);
            }}
          />
          <View style={styles.row}>
            <Field
              label={t('LATITUDE', 'LATITUD')}
              value={lat}
              onChangeText={(v) => {
                setLat(v);
                setPickedPoint(undefined);
              }}
              numeric
            />
            <Field
              label={t('LONGITUDE', 'LONGITUD')}
              value={lon}
              onChangeText={(v) => {
                setLon(v);
                setPickedPoint(undefined);
              }}
              numeric
            />
          </View>
          <View style={styles.wrap}>
            {(['water', 'shade', 'ac'] as PinKind[]).map((k) => (
              <Chip key={k} label={labels[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <Toggle
            value={share}
            onChange={setShare}
            label={t(
              'Share this pin’s coordinates publicly (opt-in)',
              'Compartir estas coordenadas públicamente (opcional)',
            )}
          />
          <Button label={t('Save place', 'Guardar lugar')} onPress={() => run(save)} />
        </Card>
      ) : null}
      {selected ? (
        <Card style={{ borderColor: C.orange }}>
          <Copy kind="h2">{selected.name}</Copy>
          <Copy>
            {selected.source} · {t('Status: ', 'Estado: ')}
            {selected.status}
          </Copy>
          {selected.kind === 'shade' ? (
            <Copy>
              {selected.feature === 'wooded-area'
                ? t(
                    'Wooded area: tree shade changes with the sun. The marker is an approximate area location, not a guaranteed shady seat.',
                    'Zona arbolada: la sombra cambia con el sol. El marcador es aproximado, no un asiento garantizado en sombra.',
                  )
                : t(
                    'Mapped shelter or pavilion: confirm public access and shade before relying on it.',
                    'Refugio o pabellón registrado: confirma el acceso público y la sombra.',
                  )}
            </Copy>
          ) : null}
          <View style={styles.wrap}>
            <Button
              icon="arrow"
              label={t('Walking directions', 'Cómo llegar a pie')}
              onPress={() => void Linking.openURL(directionsUrl(selected))}
            />
            {selected.sourceUrl ? (
              <Button
                variant="quiet"
                label={t('Source record ↗', 'Registro fuente ↗')}
                onPress={() => void Linking.openURL(selected.sourceUrl!)}
              />
            ) : null}
            <Button
              variant="secondary"
              label={t('Confirm working', 'Confirmar que funciona')}
              onPress={() => run(() => vote(selected, true))}
            />
            <Button
              variant="danger"
              label={t('Flag unavailable', 'Marcar no disponible')}
              onPress={() => run(() => vote(selected, false))}
            />
            <Button
              variant="quiet"
              label={t('Close', 'Cerrar')}
              onPress={() => setSelected(null)}
            />
          </View>
        </Card>
      ) : null}
      {mapLoading ? <Copy>{t('Loading map…', 'Cargando mapa…')}</Copy> : null}
      {!filtered.length && !mapLoading ? (
        <Card>
          <Copy kind="h2">{t('No mapped places returned yet', 'Aún no hay lugares')}</Copy>
          <Copy>
            {t(
              'Coverage varies by area. Add a known cooling place, refresh, or call 211 in the US to ask about local cooling centers.',
              'La cobertura varía. Agrega un lugar conocido, actualiza o llama al 211 en EE. UU. para consultar centros locales.',
            )}
          </Copy>
        </Card>
      ) : null}
      {filtered.slice(0, listLimit).map((p) => (
        <Card key={p.id} style={{ opacity: usablePin(p) ? 1 : 0.55 }}>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <View style={{ padding: 13, borderRadius: 13, backgroundColor: C.soft }}>
              <Icon
                name={p.kind === 'water' ? 'water' : p.kind === 'shade' ? 'leaf' : 'snow'}
                color={C.teal}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Copy kind="h2" style={{ fontSize: 19 }}>
                {p.name}
              </Copy>
              <Copy style={{ fontSize: 12, lineHeight: 18 }}>
                {p.official
                  ? t(
                      'Official cooling center · feed verified',
                      'Centro oficial · verificado por la fuente',
                    )
                  : (p.feature === 'wooded-area'
                      ? t('Potential tree shade', 'Posible sombra de árboles')
                      : p.feature === 'shelter'
                        ? t('Shade shelter / pavilion', 'Refugio / pabellón')
                        : labels[p.kind]) +
                    (p.provenance === 'municipal'
                      ? t(
                          ' · city mapped / status unverified',
                          ' · registro municipal / estado sin verificar',
                        )
                      : t(
                          ' · suggested / access unverified',
                          ' · sugerido / acceso sin verificar',
                        ))}
                {' · '}
                {p.status === 'not-working'
                  ? t('Flagged unavailable', 'No disponible')
                  : p.status === 'working'
                    ? t('You confirmed working', 'Confirmado por ti')
                    : t('Unknown status', 'Estado desconocido')}
              </Copy>
              <Copy style={{ fontSize: 12 }}>
                {Math.round(p.distance)} m · ~{p.walkMinutes}{' '}
                {t('min on foot (straight-line estimate)', 'min a pie (estimación en línea recta)')}
                {p.openingHours ? ` · ${p.openingHours}` : ''}
                {p.approximateLocation
                  ? t(' · approximate area point', ' · punto aproximado del área')
                  : ''}
              </Copy>
              {p.sourceUpdatedAt ? (
                <Copy style={{ fontSize: 11 }}>
                  {t('City record updated: ', 'Registro municipal actualizado: ')}
                  {new Date(p.sourceUpdatedAt).toLocaleDateString()}
                </Copy>
              ) : null}
              {s.risk &&
              (!s.risk.window ||
                p.walkMinutes >
                  Math.max(0, s.session ? s.remainingSeconds / 60 : s.risk.window[0]) * 0.7) ? (
                <Copy color={C.red} style={{ fontSize: 12 }}>
                  {t(
                    'This walk may use most of your break-planning window. Seek closer cooling or help; route length may be longer.',
                    'Esta caminata puede consumir tu intervalo estimado. Busca un lugar más cercano o ayuda; la ruta puede ser más larga.',
                  )}
                </Copy>
              ) : null}
              <Copy style={{ fontSize: 11 }}>
                {t('Source: ', 'Fuente: ')}
                {p.source} · {new Date(p.updatedAt).toLocaleDateString()} · {p.confirmations}{' '}
                {t('confirmations', 'confirmaciones')}, {p.reports} {t('flags', 'reportes')}
              </Copy>
            </View>
          </View>
          <View style={styles.wrap}>
            <Button
              variant="secondary"
              label={t('View place', 'Ver lugar')}
              onPress={() => {
                setSelected(p);
                explore(p);
              }}
            />
            <Button
              variant="quiet"
              icon="arrow"
              label={t('Directions', 'Cómo llegar')}
              disabled={!usablePin(p)}
              onPress={() => void Linking.openURL(directionsUrl(p))}
            />
            {p.sourceUrl ? (
              <Button
                variant="quiet"
                label={t('Source ↗', 'Fuente ↗')}
                onPress={() => void Linking.openURL(p.sourceUrl!)}
              />
            ) : null}
          </View>
        </Card>
      ))}
      {filtered.length > listLimit ? (
        <Button
          variant="secondary"
          label={t('Show more places', 'Mostrar más lugares')}
          onPress={() => setListLimit((v) => v + 30)}
        />
      ) : null}
      {(city?.warnings ?? (s.mapScope === 'nearby' ? s.mapWarnings : [])).map((v, i) => (
        <Copy key={i} style={{ fontSize: 12 }}>
          {t(
            v,
            'Verifica el acceso, el agua y los horarios. Los datos guardados y las distancias pueden no reflejar las condiciones actuales.',
          )}
        </Copy>
      ))}
    </View>
  );
}
