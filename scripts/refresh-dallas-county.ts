import { refreshMappedArea } from './refresh-districts';

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/refresh-dallas-county.ts'))
  void refreshMappedArea('dallas-county', !process.argv.includes('--baseline')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
