import { Tabs } from 'expo-router';

import { MemberHeader } from '../../components/MemberHeader';
import { TabIcon } from '../../components/TabIcon';
import { colors, fonts } from '../../theme/tokens';

function TodayHeader() {
  const dublinWeekday = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    weekday: 'long',
  })
    .format(new Date())
    .toUpperCase();

  return <MemberHeader eyebrow={dublinWeekday} title="Today" />;
}

function RewardsHeader() {
  return <MemberHeader eyebrow="SPEND YOUR WALK" title="Rewards" />;
}

function CommunitiesHeader() {
  return <MemberHeader title="Communities" />;
}

function ProfileHeader() {
  return <MemberHeader title="Profile" />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.moss,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 12,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 82,
          paddingBottom: 18,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          header: TodayHeader,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="home" />
          ),
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          header: RewardsHeader,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="rewards" />
          ),
          title: 'Rewards',
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          header: CommunitiesHeader,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="communities" />
          ),
          title: 'Communities',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          header: ProfileHeader,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="profile" />
          ),
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
