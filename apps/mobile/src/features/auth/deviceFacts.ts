import { getLocales } from 'expo-localization';

export function readDeviceFacts() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const region = getLocales()[0]?.regionCode || 'UN';

  return { region, timezone };
}
