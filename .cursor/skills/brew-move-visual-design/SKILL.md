---
name: brew-move-visual-design
description: Defines Brew & Move member-app visual design, typography, colour, cards, lists, motion, celebration, and café redemption patterns. Use when creating or changing Brew & Move mobile screens, components, navigation, rewards, earning, activity, or redemption UI.
---

# Brew & Move visual design

Design a lively café rewards product with clear hierarchy and restrained playfulness. Macadam is a reference for visual principles only. Build an original identity around walking, coffee, and Brew Points.

## Principles

1. Give each screen one dominant fact and one primary action.
2. Keep supporting information compact and readable at arm's length.
3. Use colour to communicate state: earned, selected, blocked, or redeemed.
4. Put one idea in each card. Use generous radii, quiet borders, and deliberate spacing.
5. Show Brew Points as the product language. Keep wallet, SOL, transaction, and chain terms out of member UI.
6. Preserve the three floating tabs in order: Home, BrewPoints, Discover. Profile opens from the gold B stamp. Keep Map within BrewPoints when present.

## Identity

Use the source tokens in `apps/mobile/src/theme/tokens.ts`. Ask before adding a colour, button size, or pattern.

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

- Use the Action type role, a pill shape, and one of two sizes.
- Compact is the default: 44-point height. Use it on cards and forms, such as Join, Connect, resend, Sign in, and Sign out.
- Large is 64-point height. Use it for the one primary action on a full-screen moment, such as Continue after a validation. It matches the validate swipe height.
- Primary is moss with light text. It means take the main positive action, such as Join or Connect.
- Muted is gray with ink text. It communicates an existing state that opens management, such as Joined or Connected; it is not disabled.
- Quiet is a card-coloured surface with an unobtrusive border. Use it for secondary and reversible actions such as Cancel or Sign out.
- Danger quiet uses blocked text and border. Use it as the entry point to a destructive flow, such as Delete account.
- Danger is blocked with light text. Use it only for the final destructive action inside a confirmation.
- Keep visual appearance separate from semantic state. Set appearance explicitly; `selected` exists for accessibility and does not choose a colour.
- Use clear labels and an icon where it clarifies state. Never communicate state or danger through colour alone.

The signature is a compact circular gold B stamp in the shared header that opens Profile. Show the Brew Points balance prominently on the BrewPoints tab.

The visual motif is a walking trail that curls into coffee steam. Use it for progress paths, café illustrations, and small transitions. Do not scatter it as decoration.

## Motion and playfulness

Motion makes earning feel light and never adds a step.

- Today: let the verified step count update, move toward a named milestone, and celebrate crossing it once.
- Rewards: keep browsing calm, but let pressed cards and their illustrations respond briefly.
- Swipe to redeem: move with the gesture and change status immediately.
- Respect reduced-motion preferences by showing the end state immediately.
- Use one orchestrated moment instead of scattered bouncing elements.
- Use Reanimated shared values and the presets in `apps/mobile/src/motion/presets.ts` for member-app motion. Use Gesture Handler for gesture-driven motion; do not introduce React Native `Animated` or `PanResponder`.

Do not add a mascot, coins, streaks, levels, ads, or jackpots. Do not imitate Duolingo characters or Macadam artwork.

## Lists

A screen that shows a list of records usually needs pull-to-refresh. Focus reload is not enough when the member can change data elsewhere and stay on the list, or return without remounting.

Match Rewards and Communities: `RefreshControl` with moss tint, a card-coloured progress background, and `alwaysBounceVertical` so a short list still pulls.

If it is unclear whether a list should refresh, ask before shipping without it.

## Screen patterns

### Today

- Show the gold B stamp in the header. Tapping it opens Profile.
- Activity lives under BrewPoints and the full Activity screen. It lists each validation’s added points, time, and step total. A later validation on the same day is another row. It also lists each redemption’s offer, time, partner, and points spent. Pull down to refresh the list and the balance.
- Make today's verified steps the dominant number.
- Keep the provisional milestone ladder in data. Draw every rung on a horizontal track the member can scroll, with steps and points on each stop.
- Name the next meaningful milestone and state the remaining steps.
- Celebrate crossing a milestone without blocking the screen. Once the daily cap is reached, keep the cap message in the reached-milestone style: brass steam marks, a moss heading, and a caption that says to come back tomorrow. Do not say that extra steps still count.
- Show the provisional 20,000-step daily cap. Extra steps past that cap do not raise today’s Brew Points.
- When health access is granted and a reached rung would add Brew Points, make a swipe the one primary action and state that the local day closes at midnight. The track is moss. After the drag starts, a muted overlay at the same 0.72 opacity as a pressed pill grows from the left behind the brass stamp. At rest the overlay is hidden. Chevrons nudge right until the drag starts. Releasing early does not submit. The café redemption swipe stays on its own screen.
- Hide the swipe when nothing is claimable. Do not leave a disabled swipe. Show a subtle status instead: loading while awards are unknown, reach-the-first-milestone when below 2,500, and “Validation is up to date” only after the server has recorded an award with nothing left to claim. Never imply validation succeeded without a server record.
- Below a paying rung that is already validated, keep a short caption that names the remaining steps and the Brew Points at the next milestone.
- After a confirmed award, take over the screen once: the awarded points, a line about the next rung, and Continue.

### BrewPoints

- Lead with a large Brew Points balance and the gold B stamp.
- Provide compact quick actions for Rewards (scroll), My vouchers, and Activity.
- Show every standard offer without requesting location permission.
- Do not call the list “Nearby.”
- Omit distance until location permission has already been granted.
- Sort the no-location list stably, such as by partner name.
- Each card is image-led. Use the partner photo when one is stored, and that offer’s own café illustration when it is not. Do not repeat one placeholder icon.
- Under the image, show the business name, a short description, a favourite control, the full price, the discounted price, and the Brew Points cost. Favourites are not saved yet.
- Show a collect time only when the offer has one. Most offers do not.
- Omit ratings.
- Open Activity from the quick action, not as an inline preview on BrewPoints.
- Begin redemption from offer detail. The detail opens on the same wide image, then the business name and address, the optional collect time, About this offer, and Collection instructions. Keep the full price and discounted price in a footer with the redeem action.

### Discover

- Keep a minimal coming-soon empty state. Do not invent partners, events, search, maps, or subscriptions.

### Communities

- Use Join and Joined in member-facing copy. In the MVP, joining is a lightweight association with the same behaviour as following; it can become a fuller membership concept later.
- Explain once that joining is optional and a member can join more than one community.
- Use image-led vertical cards with an original walking-and-coffee illustration, community name, short description, place, and member count.
- Put a full-width Join action on each community card. Do not require a detail screen for the action.
- Use a moss filled pill for Join. Use a muted gray pill with a downward chevron for Joined so it reads as a relationship-management control rather than another primary action.
- Tapping Joined opens a bottom-sheet confirmation. Leaving uses the blocked colour and never happens from the card without confirmation.
- Keep joining independent from earning and access to standard offers.

### Profile

- A guest sees a sign-in and create-account invitation. Do not show a sample email, display name, sign-out, or delete action to a guest.
- For an onboarded member, group Account, Health, and Account management under eyebrow labels.
- Show email and first name as read-only and let the member edit their display name.
- Show the detected health platform and a direct connection status. Connect is primary; Connected is muted and opens management rather than disconnecting immediately.
- Use a quiet sign-out action. Reserve blocked red for unavailable or destructive states that need warning.
- Put Delete account under Account management as a danger-quiet entry point, then require a bottom-sheet confirmation with a filled danger action.
- Do not show data the product does not collect or member-facing chain details.

### Swipe to redeem

This is a café handoff screen. Speed and legibility outrank decoration.

- Remove the tab bar. Keep the Brew Points stamp in the header.
- Make partner, location, offer, discount, and points readable before the gesture.
- Use exactly one instruction: “Swipe when staff can see this screen.”
- Keep one swipe action with a large target.
- Show no celebration before the swipe. Releasing early does not submit.
- After a confirmed server result, show Redeemed immediately with reward, location, redemption time, and a five-minute countdown. After five minutes, show Expired. The points stay spent.
- Location and balance checks happen before the swipe and again on the completed swipe. If they fail, show a direct explanation and next action.

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
- Does a list screen refresh, or was it confirmed that it should not?
- Does the result still follow Brew & Move product rules?
