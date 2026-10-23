import React from 'react';
import { View } from 'react-native';
import { CityDataset, CoverageRegion } from '../domain/types';
import { Card, Chip, Copy, useLocale } from './components';
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
  if (!data.regions?.length) return null;
  const active = data.regions.find((r) => r.id === selected);
  const label = data.boundaryLabel?.split(' · ')[0] ?? data.name;
  return (
    <Card>
      <Copy kind="h2">{t(`Explore all of ${label}`, `Explora todo ${label}`)}</Copy>
      {data.coverage?.status === 'baseline' ? (
        <Copy>
          {t(
            'The full district boundary and available official parks/trails are ready. Additional fountain and shade coverage is incomplete.',
            'Los límites del distrito y los parques y senderos oficiales están listos. La cobertura adicional de fuentes y sombra está incompleta.',
          )}
        </Copy>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {data.boundaryVersion}.{' '}
        {t(
          'County buttons show only the portion inside this district.',
          'Los botones muestran solo la parte del condado dentro del distrito.',
        )}
      </Copy>
      <View style={styles.wrap}>
        <Chip
          label={t(`All ${data.regions.length} counties`, `Los ${data.regions.length} condados`)}
          selected={selected === 'all'}
          onPress={onReset}
        />
        {data.regions.map((r) => (
          <Chip
            key={r.id}
            label={`${r.name}${r.partial ? t(' · part', ' · parte') : ''}`}
            selected={selected === r.id}
            onPress={() => onSelect(r)}
          />
        ))}
      </View>
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
          'community-data sections completed. These counts describe available records; sparse or empty areas may still have unmapped amenities.',
          'secciones consultadas. Las áreas con pocos datos pueden tener servicios no registrados.',
        )}
      </Copy>
      {active && !active.pinCount ? (
        <Copy>
          {t(
            'No fountain or shade records were returned for this district portion. This does not establish that none exist.',
            'No se encontraron registros para esta parte del distrito. Esto no prueba que no existan servicios.',
          )}
        </Copy>
      ) : null}
    </Card>
  );
}
