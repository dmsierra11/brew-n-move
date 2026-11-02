import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../features/auth/AuthProvider';
import { BalanceProvider } from '../features/earning/BalanceProvider';
import { HealthProvider } from '../features/health/HealthProvider';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BalanceProvider>
        <HealthProvider>
          <StatusBar style="dark" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="offer" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="my-rewards" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="voucher/[id]" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="sign-up" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="legal-document" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="validation-success" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="validations" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="communities" options={{ headerShown: false, presentation: 'card' }} />
          </Stack>
        </HealthProvider>
        </BalanceProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
