# Journey planning and recording

Journey reviews routes and early cooling breaks. It is not a heat-safety certificate or a street-routing engine. The existing weather/profile/check-in engine supplies the interval. Nearby pins and normal Watch pulse never add outdoor minutes.

## Planning and relief

Sketch mode accepts up to 100 clicked or manually entered waypoints, with undo and a dashed line. Lines connect directly; sidewalks, barriers, legal access and crossings are not routed. A published trail supplies a connected section from its line geometry instead. The selector matches endpoints at six-decimal precision, compares graph sections with the longest original path, and excludes disconnected branches. It does not promise the entire named trail, the globally longest path or present-day access.

Each route path is sampled at most every 200 m with endpoints retained. Invalid coordinates and more than 5,000 samples are rejected. Available mapped shelter/AC candidates are compared with each sample. Water, potential wooded shade, broken pins and pins with three reports are excluded from cooling-shelter coverage. The 500 m straight-line flag is app review policy, not a medical or access threshold. A rough walk-time proxy (straight-line distance at 60 m/min) also flags cooling access that reaches or exceeds the conservative break interval, even within 500 m. Real travel can take longer; a shorter proxy never proves access or safety. Missing records do not prove missing physical amenities.

Up to ten candidates show route position, off-route distance and provenance/date. Directions start from the closest sampled route position, not a live GPS origin. Detours, crossings, opening hours and active water/AC remain unverified. A candidate is not automatically a confirmed stop at the time a break is due.

## Weather and timing

Check route weather explicitly requests up to three deduplicated route points (first, middle and last sample) through the existing proxy. No full route, health profile or pulse payload is sent. Conditions are current snapshots, not street-by-street shade or future arrival weather. Refresh before leaving and during long trips. Geometry changes invalidate pending and completed analysis.

Every bundle uses the existing freshness checks and `evaluateRisk`. The shortest lower/upper interval and longest break across checked locations are retained. Any paused/stale/missing result supplies no outdoor-time interval. Symptoms take priority, and a route cannot establish medical clearance.

Moving minutes equal geometry km times the entered 3–30 min/km pace. Break count is `max(0, ceil(movingMinutes / conservativeLowerInterval) - 1)`; the total adds minimum cooling time. Detours, traffic, elevation and unplanned stops are excluded. Exertion is chosen separately from pace and updates Today’s plan; changing it ends an existing outdoor timer. GPS recording is independent.

## Foreground GPS

Start requests location permission and creates an Expo Location subscription. Pause/End/unmount remove it; hiding/locking the app pauses recording and requires explicit resume. Background and lock-screen GPS are not implemented. Delayed permission/subscription responses cannot restart a canceled recording.

Fixes require valid coordinates, accuracy at most 50 m, acquisition within 30 seconds of receipt (five-second future tolerance), and increasing timestamps. Changes under 3 m and jumps over 12 m/s within 60 seconds are excluded. Longer outages and pause/resume create separate segments with no artificial connector distance. The cap is 20,000 points. These app quality policies can undercount or reject movement. Elapsed recording time includes stops while recording but excludes pauses; recorded elapsed pace does not establish exertion or metabolism.

Routes, GPS points and pulse remain in React memory across tabs on every platform. Reload/app termination clears them. Clear/erase-all stops tracking and removes points. There is no journey history, GPX import/export, persistent route archive, background location permission or automatic location upload. The explicit weather action shares up to three selected route points.

## Wearable context and acceptance

See [APPLE-WATCH.md](APPLE-WATCH.md). Synced HealthKit and actual Watch-workout samples keep distinct source/timestamp labels. The browser never simulates a connection. Live data requires adding the supplied Watch source to a signed Xcode target and installing it on the paired devices. Native Swift compilation, GPS hardware, permissions, lock/resume behavior, Watch data, VoiceOver/TalkBack and battery use still require device acceptance.

Reference: [Expo foreground location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [CDC heat precautions](https://www.cdc.gov/heat-health/about/), and the existing methodology in [README.md](README.md).
