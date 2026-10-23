import { buildDistrict as buildCongressionalDistrict, refreshDistrict } from './refresh-districts';

export const buildDistrict = (includeOsm = true) => buildCongressionalDistrict('tx06', includeOsm);

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/refresh-tx06.ts'))
  void refreshDistrict('tx06', !process.argv.includes('--baseline')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
