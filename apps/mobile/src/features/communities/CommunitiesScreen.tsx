import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, radii, spacing } from '../../theme/tokens';
import { useAuth } from '../auth/AuthProvider';
import {
  CommunityIllustration,
  CommunityIllustrationKind,
} from './CommunityIllustration';

type Community = {
  id: string;
  name: string;
  place: string;
  description: string;
  members: number;
  illustration: CommunityIllustrationKind;
};

const communities: Community[] = [
  {
    id: 'canal-runners',
    name: 'Canal Runners',
    place: 'Grand Canal · Dublin 2',
    description: 'Easy-paced morning runs with coffee at the finish.',
    members: 184,
    illustration: 'canal',
  },
  {
    id: 'phoenix-park-walkers',
    name: 'Phoenix Park Walkers',
    place: 'Phoenix Park · Dublin 8',
    description: 'Weekend walks, fresh air, and friendly conversation.',
    members: 263,
    illustration: 'park',
  },
  {
    id: 'docklands-mornings',
    name: 'Docklands Mornings',
    place: 'North Wall · Dublin 1',
    description: 'Early starts around the river before the city wakes.',
    members: 146,
    illustration: 'docklands',
  },
];

async function readCommunities() {
  return communities;
}

function MembersIcon() {
  return (
    <Svg height={24} viewBox="0 0 28 24" width={28}>
      <Circle cx="10" cy="7" fill="none" r="4" stroke={colors.muted} strokeWidth={2} />
      <Circle cx="20" cy="8" fill="none" r="3" stroke={colors.muted} strokeWidth={2} />
      <Path d="M2 22c.3-5 3.3-8 8-8s7.7 3 8 8M17 15c4-.6 7.4 1.8 8 6" fill="none" stroke={colors.muted} strokeLinecap="round" strokeWidth={2} />
    </Svg>
  );
}

function ChevronDown() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg height={18} viewBox="0 0 18 18" width={18}>
        <Path
          d="m4 7 5 5 5-5"
          fill="none"
          stroke={colors.ink}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

export function CommunitiesScreen() {
  const { beginAccountAction, profileStatus, sessionStatus, userId } = useAuth();
  const accountReady = sessionStatus === 'signedIn' && profileStatus === 'ready';
  const [catalog, setCatalog] = useState(communities);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [pendingLeave, setPendingLeave] = useState<Community | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setCatalog(await readCommunities());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setJoined(new Set());
    setPendingLeave(null);
  }, [userId]);

  const joinCommunity = (id: string) => {
    setJoined((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const leaveCommunity = () => {
    if (!pendingLeave) {
      return;
    }

    setJoined((current) => {
      const next = new Set(current);
      next.delete(pendingLeave.id);
      return next;
    });
    setPendingLeave(null);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <ScreenBackButton accessibilityLabel="Back" />
        <AppText accessibilityRole="header" role="title" style={styles.topTitle}>
          Communities
        </AppText>
      </View>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.moss]}
            onRefresh={() => {
              void refresh();
            }}
            progressBackgroundColor={colors.card}
            refreshing={refreshing}
            tintColor={colors.moss}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <AppText role="body" style={styles.intro}>
          Find your people, then move together. Join as many communities as you like.
        </AppText>

        {catalog.length === 0 ? (
          <AppText role="caption" style={styles.empty}>
            Communities will appear here when they are available.
          </AppText>
        ) : (
          <View style={styles.list}>
            {catalog.map((community) => {
              const isJoined = joined.has(community.id);

              return (
                <View key={community.id} style={styles.card}>
                  <View style={styles.art}>
                    <CommunityIllustration kind={community.illustration} />
                  </View>
                  <View style={styles.details}>
                    <AppText role="heading">{community.name}</AppText>
                    <AppText numberOfLines={2} role="body" style={styles.description}>
                      {community.description}
                    </AppText>
                    <AppText role="caption" style={styles.place}>
                      {community.place}
                    </AppText>
                    <View style={styles.members}>
                      <MembersIcon />
                      <AppText role="body" style={styles.memberCount}>
                        {community.members} members
                      </AppText>
                    </View>
                    <PillButton
                      accessibilityLabel={
                        isJoined
                          ? `Manage membership for ${community.name}`
                          : `Join ${community.name}`
                      }
                      appearance={isJoined ? 'muted' : 'primary'}
                      fullWidth
                      label={isJoined ? 'Joined' : 'Join'}
                      onPress={() => {
                        if (isJoined) {
                          setPendingLeave(community);
                          return;
                        }

                        if (!accountReady) {
                          beginAccountAction({ type: 'join' });
                          return;
                        }

                        joinCommunity(community.id);
                      }}
                      selected={isJoined}
                      trailing={isJoined ? <ChevronDown /> : undefined}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setPendingLeave(null)}
        presentationStyle="overFullScreen"
        transparent
        visible={pendingLeave !== null}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close leave community confirmation"
            accessibilityRole="button"
            onPress={() => setPendingLeave(null)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            accessibilityViewIsModal
            edges={['bottom']}
            style={styles.sheet}
          >
            <View accessibilityElementsHidden style={styles.grabber} />
            <AppText accessibilityRole="header" role="heading">
              Leave {pendingLeave?.name}?
            </AppText>
            <AppText role="body" style={styles.sheetCopy}>
              You can join this community again at any time.
            </AppText>
            <View style={styles.sheetActions}>
              <PillButton
                accessibilityLabel={`Leave ${pendingLeave?.name ?? 'community'}`}
                appearance="danger"
                fullWidth
                label="Leave community"
                onPress={leaveCommunity}
              />
              <PillButton
                appearance="quiet"
                fullWidth
                label="Cancel"
                onPress={() => setPendingLeave(null)}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  topTitle: {
    color: colors.ink,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  intro: {
    color: colors.muted,
    marginTop: spacing.lg,
    maxWidth: 350,
  },
  list: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  art: {
    height: 180,
    width: '100%',
  },
  details: {
    padding: spacing.lg,
  },
  description: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  place: {
    color: colors.moss,
    marginTop: spacing.sm,
  },
  members: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  memberCount: {
    color: colors.muted,
  },
  empty: {
    color: colors.muted,
    marginTop: spacing.xl,
  },
  modalRoot: {
    backgroundColor: 'rgba(26, 24, 20, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 5,
    marginBottom: spacing.lg,
    width: 42,
  },
  sheetCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
