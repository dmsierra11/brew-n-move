# Brew & Move

Brew & Move lets members earn Brew Points from verified steps and redeem them at participating cafés. The member-facing product is a normal account and a points balance. Solana is the shared rewards ledger behind that balance. Members do not install a wallet, manage a seed phrase, hold SOL, or approve blockchain transactions.

The marketing site at https://brew-and-move.replit.app/ is a separate waitlist site. Use it only as a reference for product language. Do not add it to this repo.

## Repo

This repo contains:

- `apps/mobile` — React Native member app, Expo and TypeScript
- `apps/admin` — internal admin app, Vite, React, and TypeScript
- `supabase` — Postgres, auth, authorization policies, and Edge Functions
- `solana` — devnet rewards ledger

Member and admin apps share one Supabase project.

## MVP

The MVP includes sign-up, step-based earning, a rewards list, community joining, member-initiated in-person redemption, and internal admin management.

In the MVP:

- Member-facing copy uses Join and Joined. In the MVP, joining is a lightweight association that behaves like following; it may become a fuller membership concept later.
- A member can join more than one community. Joining is not required to earn Brew Points.
- Cafés and offers may be linked to a community for display. A member can see and redeem standard offers from any partner without joining that community.
- Brew & Move staff enter partners, locations, offers, and communities. Partners have no login, scanner, or app.
- Each redemption is stored in Supabase with partner, location, offer, points spent, value or discount, member, and timestamp.

Leave these for a later slice:

- Event attendance rewards
- Community-only rewards and perks
- Partner settlement, partner balances, reimbursement, invoices, and money movement
- A partner web app or any staff confirmation inside Brew & Move
- Point expiration
- Member-specific redemption limits, cooldowns, and member-only rewards

## Member navigation

Use three floating bottom tabs in this order:

- Home — today's verified steps, Brew Points earned today, and milestone progress
- BrewPoints — points balance, quick actions, standard offers, and recent activity
- Discover — coming-soon lifestyle discovery placeholder for V1

Profile opens from the gold B stamp in the shared header, outside the bottom tabs. Communities stays implemented but is not shown in the bottom bar for V1; it may return under Discover later.

Begin redemption from an offer detail screen. Do not add separate Earn, Map, Spend, Social, or Challenges tabs, or a floating centre action.

For the MVP, Map lives under rewards rather than in the bottom bar. Implement it as an independent screen and module with no dependency on the BrewPoints tab layout, so it can become a standalone tab later without rewriting its feature logic.

## Modularity

Keep screens and components independent from their current navigation position when they are likely to move, be reused, or be rebranded. Keep navigation wrappers, tab labels, and other placement-specific presentation separate from feature logic.

Prefer clear, small feature boundaries over speculative abstractions. Do not add configurability or shared layers without a concrete use case. If it is unclear how reusable or movable a screen or component needs to be, ask before implementing it.

## Stack

- Member app: Expo development builds with TypeScript. Health integrations require a development build, not Expo Go.
- iOS reads Apple HealthKit. Android reads Health Connect. Both require an explicit permission prompt.
- Steps taken while the app is closed count on the next sync.
- Admin app: Vite, React, and TypeScript.
- Auth, Postgres, and server entry points: Supabase.
- Ledger: Solana devnet. Brew & Move creates a custodial account per member and sponsors fees. Use a record format that can move to mainnet later without a redesign.
- The interface shows Brew Points. Do not show wallets, seed phrases, SOL, transaction approval, or chain jargon.

## Opening the app

The app opens without an account. Guests are not anonymous Auth users.

Guests can connect health permissions, view today's device step total, and browse standard offers and offer details. Joining a community, validating steps, and redemption require a signed-in member who has finished onboarding.

After sign-in or onboarding, return the member to the action they were attempting. Recheck the prerequisites that already exist. Do not issue Brew Points or record a redemption as part of that return.

Viewing today's health-store total does not require an account and does not create a validation record. Submitting a validation does. The first validation of the current local day includes that day's health-store total, including steps taken before sign-up and before health permission was granted. Previous days cannot be validated.

## Sign-up and profile

Members sign up with email and password, Sign in with Apple, or Sign in with Google. The current demo implements email and password. Sign in with Apple and Sign in with Google remain required before production.

The sign-up form collects:

- Email address, used for authentication, verification, and account recovery. Sign-up confirms the Auth login email so a session can start. After onboarding, Brew & Move emails a verification link. An unconfirmed address does not block onboarding or step validation. Profile shows a reminder with resend until the link is opened. Supabase Confirm email stays off.
- Password, for email sign-up only
- Acceptance of the Terms of Service
- Acknowledgement of the Privacy Policy

Onboarding, after sign-up, collects:

- First name
- Display name, used in communities. It defaults to the first name and can be changed.

Do not collect surname, username, phone number, gender, full date of birth, home address, profile photo, or a Solana wallet address.

Detect timezone, country or region, and health platform from the device. Do not ask the member to type them. Request HealthKit or Health Connect permission when step tracking is introduced, not on the sign-up form.

A guest Profile shows a sign-in and create-account invitation. An onboarded member's Profile shows the account email, a read-only first name, an editable display name, a verification reminder until the email is confirmed, health access, sign-out, and account deletion.

Profile must provide a readily discoverable way to initiate account deletion. Deletion is permanent, requires confirmation, and must remove the account and associated personal data except records that Brew & Move is legally required to retain. Retention must be disclosed. The production deletion flow and external web request path remain required. The current confirmation sheet is a visual prototype and must not be treated as a working deletion service.

## Earning

A day is the calendar day in the member's current device timezone. The open day follows the phone if the member travels.

Apple Health or Health Connect provides the current local day's total, including steps taken before health access was connected that day, steps taken before sign-up that day, and eligible steps taken while the app was closed. Previous days cannot be validated. Viewing that total does not require an account. Submitting a validation does.

The member explicitly validates the highest milestone reached before local midnight. A later validation on the same day awards only the difference to a newly reached milestone. An unvalidated day closes at midnight and cannot be recovered. Earned Brew Points stay in the balance until redeemed.

A validated day owns the absolute interval from local midnight to the next local midnight in the timezone reported with that validation. Overlap is judged on those instants, not on the timezone name. Windows that only touch at a boundary do not overlap, so the next local day stays eligible. A window that overlaps an earlier validated window awards nothing. Step samples are not stored, so that overlapping day cannot be partially paid, and it cannot be claimed once it is no longer today.

The provisional ladder is:

| Daily steps | Brew Points |
| ----------: | ----------: |
| 2,500 | 25 |
| 5,000 | 50 |
| 7,500 | 75 |
| 10,000 | 100 |
| 12,500 | 125 |
| 15,000 | 150 |
| 17,500 | 175 |
| 20,000 | 200 |

- Steps below 2,500 do not reach a milestone.
- The provisional daily maximum is 200 Brew Points at 20,000 steps.
- Steps between milestones do not raise the award.
- There is no weekly cap.
- The current pricing anchor is one specialty coffee, approximately €4.50, for 200 Brew Points.
- The ladder and offer costs are experiments. Adjust them after learning what participating businesses will provide to their communities and how members use the product.

Keep the rungs in `apps/mobile/src/features/earning/milestones.ts`. Screens and later server validation should read that list. Do not copy step thresholds into Today or other presentation. Offer prices stay on each offer.

Store only the daily step total, local date, timezone, source platform, and validation time. Do not store step samples.

## Rewards list

Without location permission, show all standard offers with no distances and no permission prompt. Order them stably, such as by partner name. Do not call that list "Nearby."

If the member grants location permission during redemption, the list may then show distances and sort by proximity.

## Offers

Every standard offer has a Brew Points cost greater than zero. Admins also enter the value or discount that will be copied onto each redemption.

A member may redeem the same offer more than once while they have enough Brew Points and the offer is still available.

An offer may have an optional total quantity and an optional expiry. If neither is set, it stays available until Brew & Move staff pause or remove it.

## Redemption

Redemption is started by the member. Café staff check the confirmation visually and apply the discount on the café till. Brew & Move does not ask staff to use software.

The member must be signed in and have finished onboarding before the location read. A guest may open the offer detail. Choosing redeem sends them through sign-in and onboarding, then back to the offer. That return rechecks the session and member row. It does not read location, spend points, or record a redemption by itself. Until the redemption service exists, the offer screen stays a demo and must not show a real redemption success.

1. The member opens the offer.
2. Immediately before showing Swipe to redeem, the app reads the current device location.
3. The device must be within 100 metres of that location's stored coordinates, and the member must have enough Brew Points.
4. If location permission is missing, block redemption and ask the member to enable location access.
5. If the member is more than 100 metres away, block redemption and say they must be at the partner location.
6. Tell the member to swipe only when staff is ready to see the confirmation.
7. The member swipes Redeem in front of staff.
8. The server deducts the points and records the redemption once.
9. The app shows a live confirmation for 5 minutes: a distinctive animated confirmation, the reward, the partner location, the redemption time, a visible countdown, and a clear Redeemed status.
10. After 5 minutes, show an Expired confirmation. The reward was redeemed, and the screen is no longer valid for staff. The redemption stays completed and the points are not returned.

## Server writes

Supabase Edge Functions are the entry point for step sync and redemption. Postgres functions apply each balance change and its Supabase record atomically.

Only a signed-in member who has finished onboarding may submit a step sync or request a redemption. Email verification is not a prerequisite for those writes. The member app may submit a step sync or request a redemption. The admin app may manage partners, locations, offers, and communities. Neither client may set Brew Points, write redemption records, or write Solana records directly.

Server-side code validates the request, applies the earning or redemption rules, records the result, and then submits the Solana devnet record. Brew & Move sponsors the fee.

If the Solana submission fails, mark it for retry. Retry must not create a second award or a second redemption.

Admin access is enforced by Supabase authorization policies. Hiding screens in the admin app is not access control.

## Solana

Solana records the economic events:

- Brew Points issued from verified activity
- Brew Points redeemed at a partner
- Prevention of a duplicate redemption
- A reference to the reward rule
- An auditable history of those events

Do not put step counts, health samples, or other personal health data on Solana. Do not put partner settlement data on Solana in the MVP.

The member sees the resulting Brew Points balance. Account creation and signing stay on the server.

## Admin app

Brew & Move staff use the admin app to create and update partners, locations, offers, and communities. Partners send details and changes to Brew & Move, and staff enter them.

Admins can see, for each member and day, the daily step total, the Brew Points awarded that day, the day, and the last sync time. Admins cannot see step samples or edit step totals. Partners cannot see step data.

## Not decided

Ask before implementing these. Do not pick a vendor, framework, or storage scheme for them:

- The Solana program framework and the on-chain account layout
- Where custodial signing keys are stored
- How the first admin role is granted
