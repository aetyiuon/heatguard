import { refreshDistrict } from './refresh-districts';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/refresh-tx30.ts'))
  void refreshDistrict('tx30', !process.argv.includes('--baseline')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
