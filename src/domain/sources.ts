export const SOURCES = {
  heatIndex: 'https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml',
  schedules: 'https://stacks.cdc.gov/view/cdc/45850/cdc_45850_DS1.pdf',
  workplace: 'https://www.cdc.gov/niosh/heat-stress/recommendations/',
  symptoms: 'https://www.cdc.gov/niosh/heat-stress/about/illnesses.html',
  symptomsSpanish:
    'https://www.cdc.gov/niosh/heat-stress/es/about/enfermedades-relacionadas-con-el-calor.html',
  heatRisk: 'https://www.wpc.ncep.noaa.gov/heatrisk/understanding.html',
  medicines:
    'https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html',
  wetBulb: 'https://doi.org/10.1175/JAMC-D-11-0143.1',
};
export const HEAT_RISK = [
  { name: 'Little to none', es: 'Poco o ninguno', color: '#4D9B59' },
  { name: 'Minor', es: 'Menor', color: '#F4F257' },
  { name: 'Moderate', es: 'Moderado', color: '#F69632' },
  { name: 'Major', es: 'Mayor', color: '#E22F33' },
  { name: 'Extreme', es: 'Extremo', color: '#7A0E7F' },
] as const;
export const TIERS = [
  { name: 'Lower', es: 'Menor', color: '#4D9B59' },
  { name: 'Moderate', es: 'Moderado', color: '#DBAF21' },
  { name: 'High', es: 'Alto', color: '#DB6836' },
  { name: 'Very high', es: 'Muy alto', color: '#AF2468' },
] as const;
export const ARLINGTON_SOURCE =
  'https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer';
