import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { DEFAULT_PROFILE, Place, Profile, Workload, Buddy } from '../domain/types';
import { evaluateRisk } from '../domain/risk';
import { fetchWeather } from './api';
import { readLocal, writeLocal, readPrivate } from './storage';
export const MONITOR_TASK = 'heatguard-weather-v1';
export interface MonitorSettings {
  enabled: boolean;
  place: Place;
  workload: Workload;
  threshold: 1 | 2 | 3;
  language: 'en' | 'es';
}
const patterns = [
  [0, 200],
  [0, 250, 150, 250],
  [0, 400, 200, 400],
  [0, 600, 150, 600, 150, 600],
];
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  TaskManager.defineTask(MONITOR_TASK, async () => {
    try {
      const settings = await readLocal<MonitorSettings | null>('monitor', null);
      if (!settings?.enabled) return BackgroundTask.BackgroundTaskResult.Success;
      const profile = await readPrivate<Profile>('profile', DEFAULT_PROFILE);
      const { data } = await fetchWeather(settings.place, false);
      const risk = evaluateRisk(data, profile, settings.workload);
      const previous = await readLocal<{ tier: number; at: number; area: string } | null>(
        'last-alert',
        null,
      );
      const area = `${settings.place.latitude},${settings.place.longitude}`;
      const crosses =
        risk.tier >= settings.threshold &&
        (!previous ||
          previous.area !== area ||
          risk.tier > previous.tier ||
          Date.now() - previous.at > 2 * 3600000);
      if (crosses) {
        await notify(
          settings.language === 'es' ? 'Aumentó el riesgo por calor' : 'Heat concern has increased',
          settings.language === 'es'
            ? 'Enfríate y revisa las condiciones. Es una estimación, no una predicción médica.'
            : 'Cool down and reassess. This is an estimate, not a medical prediction.',
          risk.tier,
          { screen: 'home' },
        );
        await writeLocal('last-alert', { tier: risk.tier, at: Date.now(), area });
      } else if (risk.tier < settings.threshold)
        await writeLocal('last-alert', { tier: risk.tier, at: 0, area });
      const ids = await readPrivate<string[]>('buddy-index', []);
      for (const id of ids.slice(0, 5)) {
        const buddy = await readPrivate<Buddy | null>(`buddy-${id}`, null);
        if (!buddy) continue;
        let concern = data.heatRisk;
        if (buddy.neighbor && buddy.place) {
          try {
            concern = (await fetchWeather(buddy.place, false)).data.heatRisk;
          } catch {
            continue;
          }
        }
        const due = buddy.neighbor
          ? concern !== undefined && concern >= 2
          : risk.tier >= settings.threshold &&
            (!buddy.lastCheckIn || Date.now() - buddy.lastCheckIn > buddy.checkInMinutes * 60000);
        const last = await readLocal<number>(`buddy-prompt-${id}`, 0);
        if (due && Date.now() - last > 2 * 3600000) {
          await notify(
            settings.language === 'es' ? 'Revisa a tu contacto' : 'Check on your buddy',
            settings.language === 'es'
              ? 'Abre HeatGuard para comunicarte con tu contacto.'
              : 'Open HeatGuard to check in with your trusted contact.',
            risk.tier,
            { screen: 'community' },
          );
          await writeLocal(`buddy-prompt-${id}`, Date.now());
        }
      }
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
export async function notificationPermission() {
  if (Platform.OS === 'web')
    throw new Error('Automatic notifications require the iOS or Android app.');
  if (Platform.OS === 'android')
    for (let tier = 0; tier < 4; tier++)
      await Notifications.setNotificationChannelAsync(`heat-${tier}`, {
        name: `HeatGuard severity ${tier}`,
        importance:
          tier >= 2
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: patterns[tier],
        sound: 'default',
      });
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted)
    p = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
  if (!p.granted) throw new Error('Notifications were declined. Manual checks still work.');
}
export async function notify(
  title: string,
  body: string,
  tier: number,
  data: Record<string, unknown>,
  seconds?: number,
) {
  if (Platform.OS === 'web') return '';
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'ios'
        ? { interruptionLevel: tier >= 2 ? 'timeSensitive' : 'active' }
        : { vibrationPattern: patterns[tier] }),
    },
    trigger: seconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor(seconds)),
          channelId: `heat-${tier}`,
        }
      : { channelId: `heat-${tier}` },
  });
}
export async function setMonitoring(settings: MonitorSettings) {
  if (!settings.enabled) {
    if (Platform.OS !== 'web' && (await TaskManager.isTaskRegisteredAsync(MONITOR_TASK)))
      await BackgroundTask.unregisterTaskAsync(MONITOR_TASK);
    await writeLocal('monitor', settings);
    return;
  }
  await notificationPermission();
  if (
    !(await TaskManager.isAvailableAsync()) ||
    (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted
  )
    throw new Error(
      'Background refresh is unavailable. Enable it in system settings; use a development build on a physical device.',
    );
  await BackgroundTask.registerTaskAsync(MONITOR_TASK, { minimumInterval: 15 });
  await writeLocal('monitor', settings);
}
export async function cancelReminders(ids: string[]) {
  if (Platform.OS !== 'web')
    await Promise.all(
      ids.filter(Boolean).map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
}
export async function scheduleSessionReminders(
  workSeconds: number,
  tier: number,
  es = false,
  askPermission = true,
) {
  if (Platform.OS === 'web') return [];
  if (askPermission) await notificationPermission();
  else if (!(await Notifications.getPermissionsAsync()).granted) return [];
  const ids: string[] = [];
  try {
    ids.push(
      await notify(
        es ? 'Hora de enfriarte' : 'Time to cool down',
        es
          ? 'Descansa en un lugar fresco. No esperes síntomas.'
          : 'Take a cooling break. Do not wait for symptoms.',
        tier,
        { screen: 'home' },
        workSeconds,
      ),
    );
    for (let minute = 15; minute * 60 < workSeconds; minute += 15)
      ids.push(
        await notify(
          es ? 'Revisa tu hidratación' : 'Hydration check',
          es
            ? 'Toma agua según tu plan. Respeta las restricciones médicas.'
            : 'Sip water according to your plan. Follow clinician fluid restrictions.',
          1,
          { screen: 'home' },
          minute * 60,
        ),
      );
    return ids;
  } catch (e) {
    await cancelReminders(ids);
    throw e;
  }
}
