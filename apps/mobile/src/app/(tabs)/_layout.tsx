import { Tabs } from 'expo-router';

import { FloatingTabBar } from '../../components/FloatingTabBar';
import { MemberHeader } from '../../components/MemberHeader';
import { colors } from '../../theme/tokens';

function TodayHeader() {
  const localWeekday = new Intl.DateTimeFormat('en-IE', {
    weekday: 'long',
  })
    .format(new Date())
    .toUpperCase();

  return <MemberHeader eyebrow={localWeekday} title="Today" />;
}

function BrewPointsHeader() {
  return <MemberHeader eyebrow="SPEND YOUR WALK" title="BrewPoints" />;
}

function DiscoverHeader() {
  return <MemberHeader title="Discover" />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        sceneStyle: { backgroundColor: colors.field },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          position: 'absolute',
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          header: TodayHeader,
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          header: BrewPointsHeader,
          title: 'BrewPoints',
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          header: DiscoverHeader,
          title: 'Discover',
        }}
      />
    </Tabs>
  );
}
