import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import { CityDataset, MapScope, ReliefPin, WeatherBundle } from '../domain/types';
import { bundledCity, polygonBounds } from '../domain/cities';
import {
  assessJourney,
  JourneyRoute,
  routeDistance,
  sampleRoute,
  mappedTrailSection,
} from '../domain/journey';
import { translatePersonalReason } from '../domain/personal';
import { evaluateRisk, toF } from '../domain/risk';
import { directionsUrl, mergePins, suggestionCoordinates } from '../domain/relief';
import { fetchJourneyWeather } from '../services/api';
import ReliefMap from '../ui/ReliefMap';
import { Button, Card, Chip, Copy, Field, useLocale } from '../ui/components';
import { WearableCard } from '../ui/WearableCard';
import { C, styles } from '../ui/theme';

export function Journey({ s }: { s: HeatGuardState }) {
  const { t, lang } = useLocale(),
    j = s.journey;
  const [mode, setMode] = useState<'plan' | 'record'>('plan'),
    [scope, setScope] = useState<MapScope>('arlington'),
    [data, setData] = useState<CityDataset>(),
    [dataError, setDataError] = useState(false);
  const [drawing, setDrawing] = useState(false),
    [pace, setPace] = useState('12'),
    [search, setSearch] = useState(''),
    [latitude, setLatitude] = useState(''),
    [longitude, setLongitude] = useState(''),
    [selected, setSelected] = useState<ReliefPin | null>(null),
    [fit, setFit] = useState(0),
    [fitRoute, setFitRoute] = useState(false);
  const [weather, setWeather] = useState<{ key: string; bundles: WeatherBundle[] } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setDataError(false);
    void bundledCity(scope === 'nearby' ? 'all-dfw' : scope)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setDataError(true);
      });
    return () => {
      active = false;
    };
  }, [scope]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const recorded = useMemo<JourneyRoute>(
    () => ({
      name: lang === 'es' ? 'Recorrido grabado' : 'Recorded journey',
      kind: 'recorded',
      paths: j.track,
    }),
    [j.track, lang],
  );
  const route = mode === 'record' ? recorded : j.route;
  const key = useMemo(() => JSON.stringify(route.paths), [route.paths]);
  const requestKey = useRef(key);
  requestKey.current = key;
  useEffect(() => {
    generation.current++;
    setWeather(null);
    setLoading(false);
    setError('');
  }, [key]);
  const pins = useMemo(() => mergePins(data?.pins ?? [], s.localPins), [data, s.localPins]);
  const paceValue = Number(pace),
    validPace =
      pace.trim() !== '' && Number.isFinite(paceValue) && paceValue >= 3 && paceValue <= 30;
  const risk = useMemo(() => {
    if (weather?.key !== key || !weather.bundles.length) return null;
    const risks = weather.bundles.map((b) =>
      evaluateRisk(b, s.profile, s.workload, s.now, s.checkIn),
    );
    const base = risks.reduce((a, b) => (a.tier >= b.tier ? a : b)),
      stop = risks.find((r) => !r.window);
    return {
      ...base,
      window: stop
        ? null
        : ([
            Math.min(...risks.map((r) => r.window![0])),
            Math.min(...risks.map((r) => r.window![1])),
          ] as [number, number]),
      stopReason: stop?.stopReason,
      lowHeat: risks.every((r) => r.lowHeat),
      breakMinutes: Math.max(...risks.map((r) => r.breakMinutes)),
    };
  }, [weather, key, s.profile, s.workload, s.now, s.checkIn]);
  const report = useMemo(() => {
    try {
      return validPace ? assessJourney(route, pins, paceValue, risk) : null;
    } catch {
      return null;
    }
  }, [route, pins, paceValue, validPace, risk]);
  const routeBounds = useMemo(() => {
    const points = route.paths.flat();
    if (!fitRoute || !points.length) return undefined;
    return polygonBounds([[points.map((p) => [p.longitude, p.latitude])]]);
  }, [route.paths, fitRoute]);
  const choices = useMemo(
    () =>
      data?.trails
        .filter((r) =>
          `${r.name} ${r.parkName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .slice(0, 6) ?? [],
    [data, search],
  );
  function addPoint(p: { latitude: number; longitude: number }) {
    if (j.route.kind !== 'sketch') {
      setError(
        t('Start a new sketch before adding waypoints.', 'Crea un boceto antes de añadir puntos.'),
      );
      return;
    }
    if (j.route.paths.flat().length >= 100) {
      setError(t('Use at most 100 sketch points.', 'Usa como máximo 100 puntos.'));
      return;
    }
    j.setRoute((r) => ({ ...r, paths: [[...(r.paths[0] ?? []), p]] }));
    setFitRoute(false);
  }
  async function analyze() {
    setError('');
    if (!report || report.meters < 10) {
      setError(
        t('Add a route of at least 10 meters.', 'Añade un recorrido de al menos 10 metros.'),
      );
      return;
    }
    const points = sampleRoute(route.paths);
    const locations = [points[0]!, points[Math.floor((points.length - 1) / 2)]!, points.at(-1)!];
    const version = ++generation.current,
      original = key;
    setLoading(true);
    try {
      const unique = [
        ...new Map(
          locations.map((p) => [`${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`, p]),
        ).values(),
      ];
      const results = await Promise.all(
        unique.map((p, i) =>
          fetchJourneyWeather({
            ...p,
            name: `Journey weather point ${i + 1}`,
            emergencyNumber: s.place.emergencyNumber,
          }),
        ),
      );
      if (version !== generation.current || requestKey.current !== original) return;
      setWeather({ key: original, bundles: results });
    } catch {
      if (version === generation.current)
        setError(
          t(
            'Route weather unavailable. No outdoor time recommendation is available; retry.',
            'Clima del recorrido no disponible. No hay recomendación de tiempo; vuelve a intentar.',
          ),
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  const gpsMessage: Record<string, string> = {
    background: t(
      'Paused when the app left the foreground. Resume here to continue; gaps are not joined.',
      'En pausa al salir de primer plano. Reanuda aquí; no se unen los intervalos.',
    ),
    permission: t(
      'Location permission was not granted. You can still plan manually.',
      'No se concedió ubicación. Puedes planear manualmente.',
    ),
    gps: t(
      'GPS unavailable. Recording is paused; check location settings.',
      'GPS no disponible. Grabación en pausa; revisa ubicación.',
    ),
    quality: t(
      'Waiting for a recent GPS fix accurate to 50 m or better.',
      'Esperando una lectura GPS reciente con precisión de 50 m o mejor.',
    ),
    jump: t('An implausible GPS jump was excluded.', 'Se excluyó un salto GPS improbable.'),
    time: t('An out-of-order GPS fix was excluded.', 'Se excluyó una lectura GPS fuera de orden.'),
    limit: t(
      'Recording point limit reached. End this recording and start a new section.',
      'Límite de puntos alcanzado. Termina e inicia otra sección.',
    ),
  };
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 8 }}>
        <Copy kind="label">{t('YOUR DAY, YOUR ROUTE', 'TU DÍA, TU RECORRIDO')}</Copy>
        <Copy kind="title">
          {t('Make room for a cool-down.', 'Deja espacio para refrescarte.')}
        </Copy>
        <Copy>
          {t(
            'Plan a route or record your walk/run. Review heat, distance and nearby relief candidates before heading out.',
            'Planea una ruta o graba tu caminata/carrera. Revisa calor, distancia y lugares de alivio antes de salir.',
          )}
        </Copy>
      </View>
      <View style={styles.wrap}>
        <Chip
          label={t('Plan a route', 'Planear ruta')}
          selected={mode === 'plan'}
          onPress={() => setMode('plan')}
        />
        <Chip
          label={t('Record with GPS', 'Grabar con GPS')}
          selected={mode === 'record'}
          onPress={() => {
            setMode('record');
            setDrawing(false);
            setFitRoute(false);
          }}
        />
      </View>
      <Card>
        <View style={styles.wrap}>
          {(
            [
              ['arlington', 'Arlington'],
              ['dallas', 'Dallas'],
              ['fort-worth', 'Fort Worth'],
              ['all-dfw', t('All mapped entries', 'Todas las entradas')],
            ] as const
          ).map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={scope === id}
              onPress={() => {
                setScope(id);
                setFitRoute(false);
                setFit((v) => v + 1);
              }}
            />
          ))}
        </View>
        {mode === 'plan' ? (
          <>
            <Field
              label={t('Route name', 'Nombre del recorrido')}
              value={j.route.name}
              onChangeText={(name) => j.setRoute((r) => ({ ...r, name: name.slice(0, 80) }))}
            />
            <View style={styles.wrap}>
              <Button
                label={
                  drawing
                    ? t('Finish drawing', 'Terminar dibujo')
                    : t('Draw on map', 'Dibujar en mapa')
                }
                disabled={j.route.kind !== 'sketch'}
                onPress={() => setDrawing((v) => !v)}
              />
              <Button
                variant="quiet"
                label={t('Undo point', 'Deshacer punto')}
                disabled={j.route.kind !== 'sketch' || !route.paths.flat().length}
                onPress={() =>
                  j.setRoute((r) => ({ ...r, paths: [(r.paths[0] ?? []).slice(0, -1)] }))
                }
              />
              <Button
                variant="quiet"
                label={t('New sketch', 'Nuevo boceto')}
                onPress={() => {
                  j.setRoute({ name: t('My route', 'Mi recorrido'), kind: 'sketch', paths: [[]] });
                  setDrawing(false);
                  setFitRoute(false);
                }}
              />
              <Button
                variant="secondary"
                label={t('Fit route', 'Ver ruta completa')}
                disabled={!route.paths.flat().length}
                onPress={() => {
                  setFitRoute(true);
                  setFit((v) => v + 1);
                }}
              />
            </View>
            <Copy color={C.orange}>
              {j.route.kind === 'sketch'
                ? t(
                    'Sketch mode joins points with straight lines. These are not street directions or verified walkable paths. Tap along the actual path you intend to follow, or select a mapped trail below.',
                    'El boceto une puntos con líneas rectas. No son indicaciones ni caminos verificados. Marca el camino real o elige un sendero abajo.',
                  )
                : t(
                    'A connected section of the mapped trail is selected; other branches may be omitted. Access, closures, surface and crossings remain unverified.',
                    'Se eligió una sección conectada del sendero; puede omitir ramales. Acceso, cierres, superficie y cruces sin verificar.',
                  )}
            </Copy>
          </>
        ) : (
          <>
            <Copy kind="h2">
              {j.status === 'recording'
                ? t('Recording · foreground GPS', 'Grabando · GPS en primer plano')
                : j.status === 'paused'
                  ? t('Recording paused', 'Grabación en pausa')
                  : j.status === 'finished'
                    ? t('Journey ended', 'Recorrido terminado')
                    : t('Ready when you are', 'Listo cuando tú quieras')}
            </Copy>
            <Copy>
              {t('Elapsed active recording time', 'Tiempo activo grabado')}:{' '}
              {Math.floor(j.elapsedMs / 60000)}:
              {String(Math.floor(j.elapsedMs / 1000) % 60).padStart(2, '0')} ·{' '}
              {(routeDistance(j.track) / 1000).toFixed(2)} km · {j.track.flat().length}{' '}
              {t('accepted GPS points', 'puntos GPS aceptados')}
            </Copy>
            <Copy>
              {t(
                'Location is requested only when you start. Recording pauses when this app is hidden or the phone locks; resume explicitly. Routes stay in memory and disappear on reload. Keep the app open for recording.',
                'La ubicación se solicita al iniciar. Se pausa al ocultar la app o bloquear el teléfono; reanuda manualmente. La ruta queda en memoria y se borra al reiniciar. Mantén la app abierta.',
              )}
            </Copy>
            <View style={styles.wrap}>
              <Button
                icon="play"
                label={
                  j.busy
                    ? t('Getting GPS…', 'Buscando GPS…')
                    : j.status === 'paused'
                      ? t('Resume recording', 'Reanudar grabación')
                      : t('Start GPS recording', 'Iniciar grabación GPS')
                }
                disabled={j.busy || j.status === 'recording'}
                onPress={() => void j.start()}
              />
              <Button
                variant="secondary"
                label={t('Pause', 'Pausar')}
                disabled={j.status !== 'recording'}
                onPress={j.pause}
              />
              <Button
                variant="quiet"
                label={t('End journey', 'Terminar recorrido')}
                disabled={j.status === 'idle' || j.status === 'finished'}
                onPress={j.finish}
              />
              <Button
                variant="quiet"
                label={t('Clear recording', 'Borrar grabación')}
                disabled={j.status === 'recording' || j.busy}
                onPress={j.clear}
              />
              <Button
                variant="secondary"
                label={t('Fit recording', 'Ver grabación')}
                disabled={!j.track.flat().length}
                onPress={() => {
                  setFitRoute(true);
                  setFit((v) => v + 1);
                }}
              />
            </View>
            {j.message ? (
              <Copy color={C.orange}>{gpsMessage[j.message] ?? gpsMessage.gps}</Copy>
            ) : null}
          </>
        )}
        <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <ReliefMap
            place={s.place}
            city={data}
            pins={pins}
            trails={data?.trails}
            showParks={false}
            showLabels={false}
            routePaths={route.paths}
            routeDashed={route.kind === 'sketch'}
            picking={mode === 'plan' && drawing}
            onPickLocation={addPoint}
            onSelect={setSelected}
            focus={
              routeBounds
                ? {
                    name: route.name,
                    bounds: routeBounds,
                    latitude: (routeBounds[1] + routeBounds[3]) / 2,
                    longitude: (routeBounds[0] + routeBounds[2]) / 2,
                  }
                : undefined
            }
            viewKey={fit}
          />
        </View>
        <Copy>
          {drawing
            ? t(
                'Drawing is on: click/tap the map to add a point. Drag to pan; wheel/pinch to zoom.',
                'Dibujo activo: toca el mapa para añadir un punto. Arrastra para mover; rueda/pellizca para acercar.',
              )
            : t(
                'Mint: your route · water: blue · shade: green · cooling candidates: orange/purple.',
                'Menta: ruta · azul: agua · verde: sombra · naranja/morado: lugares frescos.',
              )}
        </Copy>
        {!data ? (
          <Copy>
            {dataError
              ? t(
                  'Map data unavailable. Retry by selecting a city.',
                  'Datos no disponibles. Vuelve a elegir ciudad.',
                )
              : t('Loading published map data…', 'Cargando datos publicados…')}
          </Copy>
        ) : (
          <Copy style={{ fontSize: 12 }}>{data.warnings.join(' ')}</Copy>
        )}
        {selected ? (
          <Card>
            <Copy kind="h2">{selected.name}</Copy>
            <Copy>
              {selected.source} · {selected.status} · {selected.updatedAt.slice(0, 10)}
            </Copy>
            <Button
              variant="quiet"
              label={t('Close place', 'Cerrar lugar')}
              onPress={() => setSelected(null)}
            />
          </Card>
        ) : null}
        {mode === 'plan' && j.route.kind === 'sketch' ? (
          <>
            <Copy kind="h2">{t('Add a precise waypoint', 'Añadir punto exacto')}</Copy>
            <Field label={t('Latitude', 'Latitud')} value={latitude} onChangeText={setLatitude} />
            <Field
              label={t('Longitude', 'Longitud')}
              value={longitude}
              onChangeText={setLongitude}
            />
            <Button
              variant="secondary"
              label={t('Add waypoint', 'Añadir punto')}
              onPress={() => {
                const point = suggestionCoordinates(latitude, longitude);
                if (!point) {
                  setError(
                    t('Enter valid latitude and longitude.', 'Ingresa latitud y longitud válidas.'),
                  );
                  return;
                }
                addPoint(point);
                setLatitude('');
                setLongitude('');
              }}
            />
          </>
        ) : null}
      </Card>
      {mode === 'plan' ? (
        <Card>
          <Copy kind="h2">{t('Start from a mapped trail', 'Empezar desde un sendero')}</Copy>
          <Field
            label={t('Find a trail', 'Buscar sendero')}
            value={search}
            onChangeText={setSearch}
            placeholder={t(
              'Try River Legacy, Trinity, Katy…',
              'Prueba River Legacy, Trinity, Katy…',
            )}
          />
          {choices.map((trail) => (
            <Button
              key={trail.id}
              variant="secondary"
              label={`${trail.name}${trail.parkName ? ` · ${trail.parkName}` : ''}`}
              onPress={() => {
                j.setRoute({
                  name: trail.name,
                  kind: 'trail',
                  paths: [mappedTrailSection(trail.paths)],
                });
                setDrawing(false);
                setFitRoute(true);
                setFit((v) => v + 1);
              }}
            />
          ))}
          {!choices.length ? (
            <Copy>
              {t('No published trail matches this search.', 'Ningún sendero publicado coincide.')}
            </Copy>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <Copy kind="label">{t('JOURNEY REVIEW', 'REVISIÓN DEL RECORRIDO')}</Copy>
        <Field
          label={t(
            'Planned pace · minutes per kilometer (3–30)',
            'Ritmo planeado · minutos por kilómetro (3–30)',
          )}
          value={pace}
          onChangeText={setPace}
          numeric
        />
        {!validPace ? (
          <Copy color={C.orange}>
            {t('Choose a pace from 3 to 30 min/km.', 'Elige un ritmo entre 3 y 30 min/km.')}
          </Copy>
        ) : null}
        <View style={styles.wrap}>
          {(['light', 'moderate', 'heavy'] as const).map((work) => (
            <Chip
              key={work}
              label={
                work === 'light'
                  ? t('Easy walk', 'Caminata suave')
                  : work === 'moderate'
                    ? t('Brisk walk', 'Caminata rápida')
                    : t('Run / hard effort', 'Carrera / esfuerzo alto')
              }
              selected={s.workload === work}
              onPress={() => void s.chooseWork(work)}
            />
          ))}
        </View>
        <Copy>
          {t(
            'Activity changes also update Today’s plan and end an existing outdoor timer. GPS recording is separate.',
            'Cambiar actividad actualiza el plan de Hoy y termina su temporizador. La grabación GPS es independiente.',
          )}
        </Copy>
        {report && report.meters >= 10 ? (
          <>
            <Copy kind="h2">
              {route.name} · {(report.meters / 1000).toFixed(2)} km
            </Copy>
            <Copy>
              {t('Estimated moving time', 'Tiempo estimado en movimiento')}:{' '}
              {Math.ceil(report.movingMinutes)} min · {t('pace', 'ritmo')}: {paceValue} min/km
            </Copy>
            {mode === 'record' && report.meters > 0 && j.elapsedMs > 0 ? (
              <Copy>
                {t(
                  'Recorded elapsed pace (including stopped time while recording)',
                  'Ritmo registrado (incluye paradas durante la grabación)',
                )}
                : {(j.elapsedMs / 60000 / (report.meters / 1000)).toFixed(1)} min/km
              </Copy>
            ) : null}
            <Copy color={C.orange}>
              {!risk
                ? t(
                    'Check route weather to calculate cooling-break guidance.',
                    'Revisa el clima para calcular descansos.',
                  )
                : !risk.window
                  ? t(
                      'Postpone or reassess: no outdoor planning interval is available.',
                      'Pospón o reevalúa: no hay intervalo disponible.',
                    )
                  : report.uncoveredSamples || report.reliefBeyondBreak
                    ? t('Relief gaps to review', 'Hay espacios sin alivio cercano')
                    : t(
                        'Mapped relief nearby · review access',
                        'Alivio cercano cartografiado · revisa acceso',
                      )}
            </Copy>
            {risk?.lowHeat ? (
              <Copy>
                {t(
                  'Sampled route points are below heat thresholds: timed cooling breaks are not needed. Rest and drink water as you normally would.',
                  'Los puntos revisados están por debajo de los umbrales de calor: no hacen falta descansos programados. Descansa y toma agua como de costumbre.',
                )}
              </Copy>
            ) : risk?.window ? (
              <Copy>
                {t('Plan a cooling break by', 'Planea descansar a los')}: {report.breakEvery} min ·{' '}
                {t('minimum break', 'descanso mínimo')}: {risk.breakMinutes} min ·{' '}
                {t('estimated breaks', 'descansos estimados')}: {report.breakCount} ·{' '}
                {t('journey with breaks', 'recorrido con descansos')}:{' '}
                {Math.ceil(report.totalMinutes!)} min
              </Copy>
            ) : null}
            {risk?.stopReason ? (
              <Copy color={C.red}>
                {lang === 'es'
                  ? (translatePersonalReason(risk.stopReason) ??
                    'Pospón la actividad, enfríate y revisa las condiciones y tus factores personales.')
                  : risk.stopReason}
              </Copy>
            ) : null}
            <Copy>
              {t(
                'Farthest sampled point from a mapped shelter/AC candidate',
                'Punto muestreado más alejado de refugio/AC',
              )}
              :{' '}
              {report.worstReliefMeters === null
                ? t('unavailable', 'no disponible')
                : `${(report.worstReliefMeters / 1000).toFixed(2)} km`}{' '}
              · {report.uncoveredSamples}/{report.sampleCount}{' '}
              {t(
                'sample points have no such candidate within 500 m',
                'puntos sin tal lugar a 500 m',
              )}
            </Copy>
            <Copy style={{ fontSize: 12 }}>
              {t(
                '500 m is an app review flag, not a medical safety boundary. Samples are at most 200 m apart. Distances are straight-line and may cross barriers; detour times and access are unverified. Water and wooded areas do not count as confirmed cooling shelter. Break counts are scheduling arithmetic, not confirmed stop bookings.',
                '500 m es una alerta de revisión, no un límite médico. Se muestrea cada 200 m como máximo. Las distancias son rectas y pueden cruzar barreras; desvíos y acceso sin verificar. Agua y bosques no cuentan como refugio confirmado. Los descansos son un cálculo, no reservas.',
              )}
            </Copy>
            {report.reliefWalkMinutes !== null ? (
              <Copy>
                {t(
                  'Rough walk to the nearest candidate from the farthest sampled point',
                  'Caminata aproximada al lugar más cercano desde el punto más alejado',
                )}
                : {report.reliefWalkMinutes} min{' '}
                {t(
                  '(straight-line at 60 m/min; actual travel may take longer)',
                  '(en recta a 60 m/min; el viaje real puede tardar más)',
                )}
              </Copy>
            ) : null}
            {risk?.window && report.reliefBeyondBreak ? (
              <Copy color={C.orange}>
                {t(
                  'At some points, even this rough cooling-access time meets or exceeds your break-planning interval. Seek closer verified cooling or postpone; do not wait until the interval ends to leave.',
                  'En algunos puntos, el acceso aproximado al alivio alcanza o supera el intervalo de descanso. Busca un lugar verificado más cercano o pospón; no esperes al final del intervalo para salir.',
                )}
              </Copy>
            ) : null}
            <Copy kind="h2">
              {t('Relief candidates along your route', 'Posibles paradas cerca de tu ruta')}
            </Copy>
            {report.stops.slice(0, 10).map((stop) => (
              <View
                key={stop.pin.id}
                style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}
              >
                <Copy color={C.ink}>{stop.pin.name}</Copy>
                <Copy>
                  {t('Near route kilometer', 'Cerca del kilómetro')}{' '}
                  {(stop.routeMeters / 1000).toFixed(2)} · {Math.round(stop.offsetMeters)} m{' '}
                  {t(
                    'straight-line off route · hours/access unverified',
                    'fuera de la ruta en recta · acceso/horario sin verificar',
                  )}
                </Copy>
                <Copy style={{ fontSize: 12 }}>
                  {stop.pin.source} · {stop.pin.updatedAt.slice(0, 10)}
                </Copy>
                <Button
                  variant="quiet"
                  label={t(
                    'Review directions to this candidate',
                    'Revisar indicaciones a este lugar',
                  )}
                  onPress={() => {
                    const point = sampleRoute(route.paths).reduce((a, b) =>
                      Math.abs(a.meters - stop.routeMeters) < Math.abs(b.meters - stop.routeMeters)
                        ? a
                        : b,
                    );
                    void Linking.openURL(
                      directionsUrl(stop.pin, {
                        ...point,
                        name: route.name,
                        emergencyNumber: s.place.emergencyNumber,
                      }),
                    );
                  }}
                />
              </View>
            ))}
            {!report.stops.length ? (
              <Copy>
                {t(
                  'No mapped shelter/AC candidate within 500 m of sampled route points. This may be a data gap; do not assume relief is available.',
                  'No hay refugio/AC cartografiado a 500 m. Puede faltar información; no supongas que habrá alivio.',
                )}
              </Copy>
            ) : null}
          </>
        ) : (
          <Copy>
            {t(
              'Choose a trail, add at least two points, or record a route to see journey details.',
              'Elige un sendero, añade dos puntos o graba una ruta para ver detalles.',
            )}
          </Copy>
        )}
        <Button
          icon="refresh"
          label={
            loading
              ? t('Checking route weather…', 'Revisando clima…')
              : t('Check route weather', 'Revisar clima del recorrido')
          }
          disabled={loading || !report || report.meters < 10 || j.status === 'recording'}
          onPress={() => void analyze()}
        />
        <Copy style={{ fontSize: 12 }}>
          {t(
            'This checks current conditions at up to three route points, not every street or future arrival time. Location points go to the weather service; the full route and pulse do not. Refresh before leaving and during long journeys. Recording pauses are not medical recovery checks.',
            'Se revisan condiciones actuales en hasta tres puntos, no cada calle ni la hora futura de llegada. Se comparten esos puntos con el servicio meteorológico, no la ruta completa ni el pulso. Actualiza antes de salir y durante recorridos largos. Pausar no confirma recuperación.',
          )}
        </Copy>
        {weather?.key === key
          ? weather.bundles.map((b, i) => (
              <Copy key={i} style={{ fontSize: 12 }}>
                {t('Weather point', 'Punto meteorológico')} {i + 1}:{' '}
                {Math.round(toF(b.current.temperatureC))}°F / {b.current.temperatureC}°C ·{' '}
                {b.current.humidity}% ·{' '}
                {b.currentSource ?? t('source unspecified', 'fuente sin especificar')} ·{' '}
                {new Date(b.current.time).toLocaleString()} · {b.sources.join(' + ')}
              </Copy>
            ))
          : null}
        {error ? <Copy color={C.orange}>{error}</Copy> : null}
        <Copy color={C.ink}>
          {t(
            'Cooling-break estimates are general planning guidance, never a safe time outside or a guarantee. Symptoms override every route and timer. Relief records may be missing, closed or inaccessible.',
            'Los descansos son orientación general, nunca un tiempo seguro ni una garantía. Los síntomas tienen prioridad sobre rutas y temporizadores. Los lugares pueden faltar, estar cerrados o ser inaccesibles.',
          )}
        </Copy>
      </Card>
      <WearableCard s={s} />
    </View>
  );
}
