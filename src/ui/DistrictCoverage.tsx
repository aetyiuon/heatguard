import React, { useState } from 'react';
import { View } from 'react-native';
import { CityDataset, CoverageRegion } from '../domain/types';
import { Button, Card, Chip, Copy, useLocale } from './components';
import { styles } from './theme';
export function DistrictCoverage({
  data,
  selected,
  onSelect,
  onReset,
}: {
  data: CityDataset;
  selected: string;
  onSelect: (region: CoverageRegion) => void;
  onReset: () => void;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  if (!data.regions?.length) return null;
  const active = data.regions.find((r) => r.id === selected);
  const county = data.areaType === 'county';
  const visibleRegions =
    county && !expanded
      ? data.regions.filter((r, index) => index < 8 || r.id === selected)
      : data.regions;
  const label = data.boundaryLabel?.split(' · ')[0] ?? data.name;
  return (
    <Card>
      <Copy kind="h2">{t(`Explore all of ${label}`, `Explora todo ${label}`)}</Copy>
      {data.coverage?.status === 'baseline' ? (
        <Copy>
          {t(
            'The full area boundary and available official parks/trails are ready. Additional fountain and shade coverage is incomplete.',
            'Los límites del área y los parques y senderos oficiales están listos. La cobertura adicional de fuentes y sombra está incompleta.',
          )}
        </Copy>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {data.boundaryVersion}.{' '}
        {county
          ? t(
              'Community buttons show only the portion inside Dallas County, including other county areas.',
              'Los botones de comunidades muestran solo la parte dentro del condado de Dallas, incluidas otras áreas del condado.',
            )
          : t(
              'County buttons show only the portion inside this district.',
              'Los botones muestran solo la parte del condado dentro del distrito.',
            )}
      </Copy>
      <View style={styles.wrap}>
        <Chip
          label={
            county
              ? t('Entire county', 'Todo el condado')
              : t(`All ${data.regions.length} counties`, `Los ${data.regions.length} condados`)
          }
          selected={selected === 'all'}
          onPress={onReset}
        />
        {visibleRegions.map((r) => (
          <Chip
            key={r.id}
            label={`${r.name}${r.partial ? t(' · part', ' · parte') : ''}`}
            selected={selected === r.id}
            onPress={() => onSelect(r)}
          />
        ))}
      </View>
      {county && data.regions.length > 8 ? (
        <Button
          variant="quiet"
          label={
            expanded
              ? t('Show fewer county areas', 'Mostrar menos áreas del condado')
              : t('Show all county areas', 'Mostrar todas las áreas del condado')
          }
          onPress={() => setExpanded((value) => !value)}
        />
      ) : null}
      {active ? (
        <Copy>
          {active.name}: {active.pinCount}{' '}
          {t('published amenity records', 'registros publicados de servicios')} · {active.parkCount}{' '}
          {t('park features', 'elementos de parques')} · {active.trailCount}{' '}
          {t('trail features', 'senderos')}
        </Copy>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {data.coverage?.completedSections}/{data.coverage?.totalSections}{' '}
        {t(
          'OpenStreetMap query sections completed. These counts describe available records; sparse or empty areas may still have unmapped amenities.',
          'secciones de consultas de OpenStreetMap completadas. Las áreas con pocos datos pueden tener servicios no registrados.',
        )}
      </Copy>
      {active && !active.pinCount ? (
        <Copy>
          {t(
            'No amenity records were returned for this area. This does not establish that none exist.',
            'No se encontraron registros de servicios para esta área. Esto no prueba que no existan.',
          )}
        </Copy>
      ) : null}
    </Card>
  );
}
