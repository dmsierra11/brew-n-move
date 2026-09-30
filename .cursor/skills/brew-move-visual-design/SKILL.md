---
name: brew-move-visual-design
description: Defines Brew & Move member-app visual design, typography, colour, cards, motion, celebration, and café redemption patterns. Use when creating or changing Brew & Move mobile screens, components, navigation, rewards, earning, or redemption UI.
---

# Brew & Move visual design

Design a lively café rewards product with clear hierarchy and restrained playfulness. Macadam is a reference for visual principles only. Build an original identity around walking, coffee, and Brew Points.

## Principles

1. Give each screen one dominant fact and one primary action.
2. Keep supporting information compact and readable at arm's length.
3. Use colour to communicate state: earned, selected, blocked, or redeemed.
4. Put one idea in each card. Use generous radii, quiet borders, and deliberate spacing.
5. Show Brew Points as the product language. Keep wallet, SOL, transaction, and chain terms out of member UI.
6. Preserve the four tabs in order: Home, Rewards, Communities, Profile. Keep Map within Rewards.

## Identity

Use the source tokens in `apps/mobile/src/theme/tokens.ts`.

- Field `#F3F4F1`: app background
- Card `#FFFFFF`: raised content
- Ink `#1A1814`: primary copy
- Moss `#315C47`: actions, progress, selection
- Brass `#A6844A`: Brew Points stamp only
- Oat, sky, and berry: muted illustration accents only
- Blocked `#8C2F2F`: destructive or unavailable state

Use Bricolage Grotesque for display text and Figtree for interface text. Let display type carry personality; keep body copy calm.

Use the named roles from `apps/mobile/src/theme/tokens.ts` through `AppText`:

- Hero — 74, Bricolage ExtraBold. The one dominant number.
- Display — 48, Bricolage ExtraBold. A dominant title without the tab header.
- Title — 40, Bricolage ExtraBold. Tab titles and confirmation headlines.
- Stat — 38, Bricolage ExtraBold. A secondary number beside a label.
- Value — 28, Bricolage Bold. A reward discount or value.
- Heading — 21, Bricolage Bold. Card and milestone titles.
- Action — 17, Figtree Bold. Buttons, swipe labels, and short units.
- Body — 16, Figtree Regular. Introductions and primary instructions.
- Caption — 13, Figtree Regular. Supporting sentences and metadata.
- Eyebrow — 11, Figtree Bold, uppercase and tracked. Days, sections, and partner names.

Keep text measurements local when they belong to a composition rather than a reusable hierarchy, such as trail checkpoint labels and café staff proof figures.

## Buttons

- Use the Action type role, a pill shape, and a minimum 44-point touch target.
- Primary is moss with light text. It means take the main positive action, such as Join or Connect.
- Muted is gray with ink text. It communicates an existing state that opens management, such as Joined or Connected; it is not disabled.
- Quiet is a card-coloured surface with an unobtrusive border. Use it for secondary and reversible actions such as Cancel or Sign out.
- Danger quiet uses blocked text and border. Use it as the entry point to a destructive flow, such as Delete account.
- Danger is blocked with light text. Use it only for the final destructive action inside a confirmation.
- Keep visual appearance separate from semantic state. Set appearance explicitly; `selected` exists for accessibility and does not choose a colour.
- Use clear labels and an icon where it clarifies state. Never communicate state or danger through colour alone.

The signature is a compact circular brew stamp paired with the member's Brew Points balance in the header.

The visual motif is a walking trail that curls into coffee steam. Use it for progress paths, café illustrations, and small transitions. Do not scatter it as decoration.

## Motion and playfulness

Motion makes earning feel light and never adds a step.

- Today: let the verified step count update, move toward a named milestone, and celebrate crossing it once.
- Rewards: keep browsing calm, but let pressed cards and their illustrations respond briefly.
- Swipe to redeem: move with the gesture and change status immediately.
- Respect reduced-motion preferences by showing the end state immediately.
- Use one orchestrated moment instead of scattered bouncing elements.
- Use Reanimated shared values and the presets in `apps/mobile/src/motion/presets.ts` for member-app motion. Use Gesture Handler for gesture-driven motion; do not introduce React Native `Animated` or `PanResponder`.

Do not add a mascot, coins, streaks, levels, ads, jackpots, or a “validate my steps” action. Do not imitate Duolingo characters or Macadam artwork.

## Screen patterns

### Today

- Show the points stamp in the header.
- Make today's verified steps the dominant number.
- Show Brew Points earned today nearby.
- Explain that 100 steps earn 1 Brew Point.
- Name the next meaningful milestone and state the remaining steps.
- Celebrate crossing a milestone without blocking the screen.
- Show the 10,000-step daily cap without implying that steps beyond it disappear.

### Rewards

- Show every standard offer without requesting location permission.
- Do not call the list “Nearby.”
- Omit distance until location permission has already been granted.
- Sort the no-location list stably, such as by partner name.
- Each card shows partner, offer, discount or value, and points cost.
- Give each offer a distinct original café illustration; do not repeat one placeholder icon.
- Begin redemption from offer detail.

### Communities

- Use Join and Joined in member-facing copy. In the MVP, joining is a lightweight association with the same behaviour as following; it can become a fuller membership concept later.
- Explain once that joining is optional and a member can join more than one community.
- Use image-led vertical cards with an original walking-and-coffee illustration, community name, short description, place, and member count.
- Put a full-width Join action on each community card. Do not require a detail screen for the action.
- Use a moss filled pill for Join. Use a muted gray pill with a downward chevron for Joined so it reads as a relationship-management control rather than another primary action.
- Tapping Joined opens a bottom-sheet confirmation. Leaving uses the blocked colour and never happens from the card without confirmation.
- Keep joining independent from earning and access to standard offers.

### Profile

- Group Account, Health, and Account management under eyebrow labels.
- Show email as read-only and let the member edit their display name.
- Show the detected health platform and a direct connection status. Connect is primary; Connected is muted and opens management rather than disconnecting immediately.
- Use a quiet sign-out action. Reserve blocked red for unavailable or destructive states that need warning.
- Put Delete account under Account management as a danger-quiet entry point, then require a bottom-sheet confirmation with a filled danger action.
- Do not show data the product does not collect or member-facing chain details.

### Swipe to redeem

This is a café handoff screen. Speed and legibility outrank decoration.

- Remove the tab bar.
- Make partner, location, offer, discount, and points readable before the gesture.
- Use exactly one instruction: “Swipe when staff can see this screen.”
- Keep one swipe action with a large target.
- Show no celebration before the swipe.
- After success, show Redeemed immediately with reward, location, redemption time, and a five-minute countdown.
- Location and balance checks happen before this screen. If they fail, show a direct explanation and next action.

## Celebration

Celebrate a completed economic event once. Use a short colour or type transition and one sentence with one way forward. Never delay proof of redemption or obscure details staff need to verify.

## Critique checklist

- Is one fact visually dominant?
- Is there one obvious action?
- Are points and state legible without relying on colour alone?
- Can café staff read the redemption details at arm's length?
- Does motion help comprehension and respect reduced motion?
- Does every offer illustration feel distinct while belonging to the same café world?
- Are Macadam-specific game mechanics and artwork absent?
- Does the result still follow Brew & Move product rules?
