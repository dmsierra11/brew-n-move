export type HealthAccessStatus = 'denied' | 'granted' | 'unavailable' | 'undetermined';

export type HealthAccess = {
  status: HealthAccessStatus;
};
