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
          <Text style={styles.redeemedStatus}>REDEEMED</Text>
          <Text style={styles.redeemedTitle}>{selectedOffer.title}</Text>
          <Text style={styles.redeemedPartner}>
            {selectedOffer.partner} · {selectedOffer.location}
          </Text>
        </View>

        <View style={styles.proofCard}>
          <View>
            <Text style={styles.proofLabel}>Redeemed at</Text>
            <Text style={styles.proofValue}>12:41</Text>
          </View>
          <View style={styles.proofDivider} />
          <View>
            <Text style={styles.proofLabel}>Valid for staff</Text>
            <Text style={styles.proofValue}>4:59</Text>
          </View>
        </View>

        <Text style={styles.staffNote}>Show this live confirmation to café staff.</Text>
        <Pressable onPress={() => router.back()} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
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
          <Text style={styles.partner}>{selectedOffer.partner}</Text>
          <Text style={styles.location}>{selectedOffer.location}</Text>
          <Text style={styles.offer}>{selectedOffer.title}</Text>
          <Text style={styles.value}>{selectedOffer.value}</Text>
        </View>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Your balance</Text>
            <Text style={styles.summaryValue}>412 points</Text>
          </View>
          <View style={styles.minus}>
            <Text style={styles.minusText}>−{selectedOffer.points}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.instruction}>Swipe when staff can see this screen.</Text>
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
            <Text style={styles.sliderText}>Swipe to redeem</Text>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.thumb, thumbStyle]}>
                <Text style={styles.thumbText}>→</Text>
              </Animated.View>
            </GestureDetector>
          </View>
          <Text style={styles.finalCopy}>This action spends Brew Points immediately.</Text>
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
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  location: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 4,
  },
  offer: {
    color: colors.ink,
    fontFamily: fonts.displayExtra,
    fontSize: 48,
    letterSpacing: -1.8,
    lineHeight: 50,
    marginTop: spacing.xl,
    maxWidth: 330,
  },
  value: {
    color: colors.brass,
    fontFamily: fonts.display,
    fontSize: 28,
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
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 19,
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
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  bottom: {
    marginTop: 'auto',
  },
  instruction: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 16,
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
    fontFamily: fonts.bold,
    fontSize: 17,
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
    fontFamily: fonts.body,
    fontSize: 12,
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
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: spacing.lg,
  },
  redeemedTitle: {
    color: colors.card,
    fontFamily: fonts.displayExtra,
    fontSize: 40,
    letterSpacing: -1.2,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  redeemedPartner: {
    color: colors.mossSoft,
    fontFamily: fonts.medium,
    fontSize: 15,
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
    fontFamily: fonts.medium,
    fontSize: 12,
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
    fontFamily: fonts.body,
    fontSize: 14,
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
    fontFamily: fonts.bold,
    fontSize: 17,
  },
});
