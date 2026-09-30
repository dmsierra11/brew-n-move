import { router } from 'expo-router';
import { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { motionDurations, motionSprings } from '../../motion/presets';
import { colors, fonts, radii, spacing } from '../../theme/tokens';
import { selectedOffer } from '../rewards/offers';

const thumbSize = 62;

export function RedeemScreen() {
  const dragX = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const maxDrag = useSharedValue(0);
  const [redeemed, setRedeemed] = useState(false);
  const reduceMotion = useReducedMotion();

  const markRedeemed = () => setRedeemed(true);

  const completeRedemption = () => {
    if (reduceMotion) {
      dragX.value = maxDrag.value;
      markRedeemed();
      return;
    }

    dragX.value = withTiming(
      maxDrag.value,
      { duration: motionDurations.redeem },
      (finished) => {
        if (finished) {
          scheduleOnRN(markRedeemed);
        }
      },
    );
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      dragStart.value = dragX.value;
    })
    .onUpdate((event) => {
      dragX.value = Math.max(
        0,
        Math.min(dragStart.value + event.translationX, maxDrag.value),
      );
    })
    .onEnd(() => {
      if (dragX.value > maxDrag.value * 0.7) {
        if (reduceMotion) {
          dragX.value = maxDrag.value;
          scheduleOnRN(markRedeemed);
        } else {
          dragX.value = withTiming(
            maxDrag.value,
            { duration: motionDurations.redeem },
            (finished) => {
              if (finished) {
                scheduleOnRN(markRedeemed);
              }
            },
          );
        }
        return;
      }

      dragX.value = reduceMotion ? 0 : withSpring(0, motionSprings.settle);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  if (redeemed) {
    return (
      <SafeAreaView style={styles.redeemedPage}>
        <View style={styles.redeemedTop}>
          <View style={styles.check}>
            <Text style={styles.checkText}>✓</Text>
          </View>
          <AppText role="eyebrow" style={styles.redeemedStatus}>Redeemed</AppText>
          <AppText role="title" style={styles.redeemedTitle}>{selectedOffer.title}</AppText>
          <AppText role="caption" style={styles.redeemedPartner}>
            {selectedOffer.partner} · {selectedOffer.location}
          </AppText>
        </View>

        <View style={styles.proofCard}>
          <View>
            <AppText role="caption" style={styles.proofLabel}>Redeemed at</AppText>
            <Text style={styles.proofValue}>12:41</Text>
          </View>
          <View style={styles.proofDivider} />
          <View>
            <AppText role="caption" style={styles.proofLabel}>Valid for staff</AppText>
            <Text style={styles.proofValue}>4:59</Text>
          </View>
        </View>

        <AppText role="caption" style={styles.staffNote}>Show this live confirmation to café staff.</AppText>
        <Pressable onPress={() => router.back()} style={styles.doneButton}>
          <AppText role="action" style={styles.doneText}>Done</AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Pressable
          accessibilityLabel="Back to rewards"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.offerBlock}>
          <AppText role="eyebrow" style={styles.partner}>{selectedOffer.partner}</AppText>
          <AppText role="caption" style={styles.location}>{selectedOffer.location}</AppText>
          <AppText role="display" style={styles.offer}>{selectedOffer.title}</AppText>
          <AppText role="value" style={styles.value}>{selectedOffer.value}</AppText>
        </View>

        <View style={styles.summary}>
          <View>
            <AppText role="caption" style={styles.summaryLabel}>Your balance</AppText>
            <AppText role="action" style={styles.summaryValue}>412 points</AppText>
          </View>
          <View style={styles.minus}>
            <AppText role="action" style={styles.minusText}>−{selectedOffer.points}</AppText>
          </View>
        </View>

        <View style={styles.bottom}>
          <AppText role="body" style={styles.instruction}>Swipe when staff can see this screen.</AppText>
          <View
            accessibilityActions={[{ name: 'activate', label: 'Redeem offer' }]}
            accessibilityLabel={`Swipe to spend ${selectedOffer.points} points`}
            accessibilityRole="button"
            onAccessibilityAction={completeRedemption}
            onLayout={(event: LayoutChangeEvent) => {
              maxDrag.value = Math.max(
                0,
                event.nativeEvent.layout.width - thumbSize - 10,
              );
            }}
            style={styles.slider}
          >
            <AppText role="action" style={styles.sliderText}>Swipe to redeem</AppText>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.thumb, thumbStyle]}>
                <Text style={styles.thumbText}>→</Text>
              </Animated.View>
            </GestureDetector>
          </View>
          <AppText role="caption" style={styles.finalCopy}>This action spends Brew Points immediately.</AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
    flex: 1,
  },
  page: {
    flex: 1,
    padding: spacing.lg,
  },
  back: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 34,
    lineHeight: 37,
  },
  offerBlock: {
    marginTop: 44,
  },
  partner: {
    color: colors.moss,
  },
  location: {
    color: colors.muted,
    marginTop: 4,
  },
  offer: {
    color: colors.ink,
    marginTop: spacing.xl,
    maxWidth: 330,
  },
  value: {
    color: colors.brass,
    marginTop: spacing.sm,
  },
  summary: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  summaryLabel: {
    color: colors.muted,
  },
  summaryValue: {
    color: colors.ink,
    marginTop: 3,
  },
  minus: {
    backgroundColor: colors.brassSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  minusText: {
    color: colors.ink,
  },
  bottom: {
    marginTop: 'auto',
  },
  instruction: {
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  slider: {
    backgroundColor: colors.ink,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    padding: 5,
  },
  sliderText: {
    color: colors.card,
    textAlign: 'center',
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: colors.brass,
    borderRadius: 31,
    height: thumbSize,
    justifyContent: 'center',
    left: 5,
    position: 'absolute',
    width: thumbSize,
  },
  thumbText: {
    color: colors.card,
    fontFamily: fonts.body,
    fontSize: 28,
  },
  finalCopy: {
    color: colors.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  redeemedPage: {
    alignItems: 'center',
    backgroundColor: colors.moss,
    flex: 1,
    padding: spacing.lg,
  },
  redeemedTop: {
    alignItems: 'center',
    marginTop: 72,
  },
  check: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 39,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  checkText: {
    color: colors.moss,
    fontFamily: fonts.bold,
    fontSize: 38,
  },
  redeemedStatus: {
    color: colors.brassSoft,
    letterSpacing: 2,
    marginTop: spacing.lg,
  },
  redeemedTitle: {
    color: colors.card,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  redeemedPartner: {
    color: colors.mossSoft,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  proofCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 52,
    padding: spacing.lg,
    width: '100%',
  },
  proofLabel: {
    color: colors.muted,
  },
  proofValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 25,
    marginTop: 4,
  },
  proofDivider: {
    backgroundColor: colors.line,
    width: 1,
  },
  staffNote: {
    color: colors.mossSoft,
    marginTop: spacing.lg,
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    marginTop: 'auto',
    paddingVertical: 18,
    width: '100%',
  },
  doneText: {
    color: colors.ink,
  },
});
