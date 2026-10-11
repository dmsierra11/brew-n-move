import * as Location from 'expo-location';

export type DeviceLocation =
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; latitude: number; longitude: number };

export async function requestDeviceLocation(): Promise<DeviceLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { kind: 'denied' };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { kind: 'unavailable' };
    }

    return { kind: 'ready', latitude, longitude };
  } catch {
    return { kind: 'unavailable' };
  }
}
