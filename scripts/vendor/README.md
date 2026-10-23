# Geometry tools used by the data collector

These files run only in the local ingestion scripts and geometry tests. They are not imported by the mobile app or the Worker.

- `polygon-clipping.cjs`: unmodified `dist/polygon-clipping.umd.js` from [polygon-clipping 0.15.7](https://github.com/mfogel/polygon-clipping), distributed under the included MIT license. npm tarball SHA-512 integrity: `sha512-nhfdr83ECBg6xtqOAJab1tbksbBAOMUltN60bU+llHVOL0e5Onm1WpAXXWXVB39L8AJFssoIhEVuy/S90MmotA==`.
- `osmtogeojson.cjs`: unmodified browser distribution `osmtogeojson.js` from [osmtogeojson 3.0.0-beta.5](https://github.com/tyrasd/osmtogeojson), distributed under the included MIT license. npm tarball SHA-512 integrity: `sha512-izvaUWnunrYvMB4LB0ZN15O1+g90c628yHS4SeSR3daVSBF9vdTHL7iVHfg0wEr1uEYjQ+lMJHCiYFusL5yKVg==`.

The archives were downloaded from the npm registry over validated HTTPS and verified against the registry's SHA-512 integrity values before extracting these exact files. The browser distributions retain their bundled dependencies and notices. Vendoring the standalone distributions avoids requiring new package-manager links on this Windows host. Application dependency versions and the existing lockfile are unchanged.
