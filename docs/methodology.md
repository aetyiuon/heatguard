# Methodology and privacy

This guide documents implemented policy, not medical validation. [Back to the project](../README.md).

## Automatically updated temperature

Today prominently displays the selected location's current air temperature in Fahrenheit and Celsius, heat index in shade, humidity and reading time/age. **Weather details** expands the last successful API check and refresh cadence. The card's concern accents and the existing cooling-break plan respond to new conditions and profile/activity changes. Official daily NWS HeatRisk remains a separate forecast. This is weather for the named heat-check location, not an assumed GPS position or a reading from the phone's sensors.

Weather loads automatically after saved settings are restored, checks every five minutes while the app is in the foreground, and checks on return with a one-minute cooldown to avoid duplicate focus requests. Overlapping requests are coalesced; old-location results are discarded. A manual **Refresh temperature** action remains available. The existing native background opt-in remains OS-scheduled and does not guarantee this foreground cadence when the app is closed.

Open-Meteo supplies **modeled current conditions**, based on [15-minute weather-model time steps](https://open-meteo.com/en/docs), rather than a continuously measured thermometer feed. Checks may return the same reading, and upstream/edge caches remain in use. If Open-Meteo is unavailable, the NWS hourly forecast fallback is labeled as a forecast. Previous saved readings and failed refreshes are clearly marked; old/invalid readings block starting a new activity timer. The reading timestamp and API check time remain distinct so downloading an old value does not make it look new.

## Personal check-in

On **Today** or **My plan**, choose **Add my check-in**. After opting in, record how you feel, hydration before going out, clothing, and optional measured pulse/thermometer values. Choose Fahrenheit or Celsius, the measurement site, pulse context (activity or after five minutes of quiet sitting), and how recently the readings were taken. New forms leave readings and symptoms blank/unknown rather than re-dating a previous measurement. Measurements are timestamped on entry and must still be within five minutes when saved. No watch or thermometer is required.

The check-in feeds the same pure risk engine as weather, activity and the optional age/height/weight/conditions/medications/acclimatization profile. Symptoms suppress the countdown even in cool weather. A known adult's rested pulse above 100 bpm or a non-wrist thermometer reading of at least 38°C / 100.4°F triggers a **conservative app pause**, not a diagnosis. These use [AHA resting-pulse context](https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse) and [NHS adult thermometer guidance](https://www.nhs.uk/symptoms/fever-in-adults/); these sources do not validate HeatGuard as a heat-strain model. Adult pulse thresholds are not applied to children or unknown ages. Wrist/skin temperature and exercise pulse are shown as context only. Symptoms take priority over all readings, and normal vitals never extend the underlying recommendation.

The current check-in replaces the saved hydration answer. Low reported hydration before heat exposure pauses activity while preparing water/cooling; heavy/protective clothing in heat requires a specific plan because the sample schedule does not cover it. Hydration is a self-report, never a measured percentage or a calculated fluid deficit. Clinical fluid restrictions take priority. Activity categories represent metabolic heat; the app does not infer metabolic rate from pulse, compute a personalized calorie-to-exposure formula, or predict time to heat illness. Height and weight supply an adult BMI caution only when adult age is known, never a minute multiplier.

Check-ins are current for **30 minutes**; optional vital readings are current for **5 minutes**. These intervals are app policy, not medical recovery limits. An outdated/invalid check-in suppresses the countdown until updated. An earlier symptom/high-reading caution does not vanish as its timestamp ages. Saving a new assessment or completing a break is not medical clearance. Omission of a check-in keeps the general weather/profile plan available; it does not establish safety. Native opt-in background weather checks use the same saved check-in, without claiming continuous physiological monitoring.

The snapshot is separate from the long-term profile: encrypted device-only SecureStore on iOS/Android, memory only in the browser. **Delete my check-in** and erase-all remove it. No health fields enter weather/map requests or shared cards. Optional Apple Health and Watch readings are separate, context-only inputs displayed in Journey and My plan; they are not silently treated as rested measurements or used to extend the break interval. See [apple-watch.md](apple-watch.md) for native integration, signing and device-acceptance requirements. Android Health Connect remains unimplemented. Sleeping wrist temperature is not live core temperature.

## Risk model and limits

The pure engine is in `src/domain/risk.ts`, independently tested. It implements NWS's preliminary heat-index calculation, Rothfusz regression and humidity corrections. Official **NWS HeatRisk 0–4 is never generated or personalized locally**. The badge is a daily forecast; the activity recommendation also considers current conditions and workload. Missing today's raster does not authorize reusing tomorrow's rating.

The work/rest lookup transcribes the [NIOSH 2017-127 sample schedule](https://stacks.cdc.gov/view/cdc/45850/cdc_45850_DS1.pdf). It uses **air temperature with sun/humidity adjustments**, not heat index or a made-up injury curve. Normal cells are mapped to a bounded app planning interval. Caution cells suppress numeric activity windows. The sample assumes fit, rested, hydrated adult workers under 40, normal clothing and perceptible air movement; it is not a general population guarantee.

Displayed ranges, concern escalation, low-wind handling and personal-factor caps are **explicit conservative HeatGuard policy**, not published personal tolerance limits. Factors can only increase concern in heat; reported symptoms and concerning vital readings can also pause activity in cool weather. Sex never changes minutes. Adult BMI is only a coarse caution flag when adult age is known. Heat acclimatization does not negate environmental risk. Children in heat do not receive an occupational countdown. The in-app methodology screen distinguishes original source cycles from app policy. Model v0.2.0 adds the optional check-in and pause rules without changing the published schedule.

WBGT is a **screening approximation**, not measured WBGT or validated Liljegren: Stull psychrometric wet bulb plus a simplified black-globe solar/wind energy balance. The assumptions are documented in code; it is never used to assign occupational work/rest minutes. Protective equipment, radiant surroundings, fluid restrictions and individual illness need an appropriate heat plan and professional input.

Data older than one hour, invalid/future timestamps, very high concern, unavailable water in heat and NIOSH Caution suppress the activity timer. Caches display their data time. Symptoms always take priority. Logging a break is not proof of physiological recovery.

## Notifications and background behavior

`expo-background-task` and `expo-task-manager` use Android WorkManager and iOS BGTaskScheduler. Monitoring is a **saved-place** check; there is no background GPS tracking. Requesting a 15-minute minimum interval does not guarantee that frequency. OS scheduling, connectivity, battery saving and force-quit can prevent alerts. Re-open the app and check conditions manually. Expo Go and simulators are not sufficient acceptance tests.

Android channels provide severity-specific vibration patterns; users and device settings can change delivery. iOS uses system sounds/haptics, with Time Sensitive interruption for high concern. User permission and Focus settings govern delivery. Time Sensitive does **not** override the Silent switch; no critical-alert entitlement or silent Do Not Disturb bypass is claimed.

Tapping a local notification opens the risk/community screen and refreshes conditions. Session notifications use the **lower end** of the range, and stop/reschedule as recommendations change. On the browser, the in-app timer works but there are no native background alerts.

## Weather provenance and usage

- [NWS API](https://www.weather.gov/documentation/services-web-api): points, hourly/daily forecast and active heat alerts. Hourly values are forecasts, not observations. Hourly `shortForecast` wording sets the decorative sky; "Slight Chance"/"Chance" precipitation is drawn as clouds, not as falling rain or snow.
- [NOAA HeatRisk ImageServer](https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer): dated raster catalog, locked-raster point identification, raw numeric values, NoData handling.
- [Open-Meteo](https://open-meteo.com/en/docs): modeled current values, hourly humidity/wind/radiation/UV, WMO weather codes for the decorative sky, the place's time zone, daily forecast, global fallback. Current modeled conditions are labeled. Check licensing/commercial plan requirements before a commercial launch.
- [AirNow](https://docs.airnowapi.org): server-only registration key; optional regional AQI, observed time retained. No AQI means no air-quality conclusion.
- [NWS heat-index formula](https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml), [NIOSH prevention/hydration](https://www.cdc.gov/niosh/heat-stress/recommendations/), [CDC/NIOSH symptoms](https://www.cdc.gov/niosh/heat-stress/about/illnesses.html), [CDC medication guidance](https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html), [Stull wet-bulb paper](https://doi.org/10.1175/JAMC-D-11-0143.1).

The four heat-index awareness tiers are historical OSHA guidance, **not** a claim about current legal work/rest requirements. The five-color green/yellow/orange/red/magenta legend is the official HeatRisk palette. Unknown HeatRisk is explicitly marked.

## Data boundaries

Native optional profiles, check-ins and contacts use device-only SecureStore after first unlock. The browser keeps health/contact entries in memory; reload clears them. Weather and relief metadata may be cached separately. There is no cloud profile synchronization or app analytics. Weather providers see the selected location; basemap providers receive tile requests.

Personal AI is a separate reviewed opt-in to the HeatGuard server and Groq; contacts, routes and wearable histories are excluded. AI prose can repeat entered facts and remains sensitive/fallible. See [AI](ai.md). Community writes have separate consent and storage rules; see [Deployment](deployment.md).

Buddy reminders notify the user's own device. SMS opens a composer for the user to review and send. No automatic buddy message delivery or emergency monitoring is implemented.
