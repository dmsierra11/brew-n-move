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

The MVP includes sign-up, step-based earning, a rewards list, community following, member-initiated in-person redemption, and internal admin management.

In the MVP:

- A member can follow more than one community. Following is not required to earn Brew Points.
- Cafés and offers may be linked to a community for display. A member can see and redeem standard offers from any partner without following that community.
- Brew & Move staff enter partners, locations, offers, and communities. Partners have no login, scanner, or app.
- Each redemption is stored in Supabase with partner, location, offer, points spent, value or discount, member, and timestamp.

Leave these for a later slice:

- Event attendance rewards
- Community-only rewards and perks
- Partner settlement, partner balances, reimbursement, invoices, and money movement
- A partner web app or any staff confirmation inside Brew & Move
- Point expiration
- Member-specific redemption limits, cooldowns, and member-only rewards

## Stack

- Member app: Expo development builds with TypeScript. Health integrations require a development build, not Expo Go.
- iOS reads Apple HealthKit. Android reads Health Connect. Both require an explicit permission prompt.
- Steps taken while the app is closed count on the next sync.
- Admin app: Vite, React, and TypeScript.
- Auth, Postgres, and server entry points: Supabase.
- Ledger: Solana devnet. Brew & Move creates a custodial account per member and sponsors fees. Use a record format that can move to mainnet later without a redesign.
- The interface shows Brew Points. Do not show wallets, seed phrases, SOL, transaction approval, or chain jargon.

## Sign-up and profile

Members sign up with email and password, Sign in with Apple, or Sign in with Google.

The sign-up form collects:

- Email address, used for authentication, verification, and account recovery
- Password, for email sign-up only
- Acceptance of the Terms of Service
- Acknowledgement of the Privacy Policy

Onboarding, after sign-up, collects:

- First name
- Display name, used in communities. It defaults to the first name and can be changed.

Do not collect surname, username, phone number, gender, full date of birth, home address, profile photo, or a Solana wallet address.

Detect timezone, country or region, and health platform from the device. Do not ask the member to type them. Request HealthKit or Health Connect permission when step tracking is introduced, not on the sign-up form.

## Earning

A day is the `Europe/Dublin` calendar day, including daylight-saving changes. Do not use the device timezone to define a day.

Only steps taken after both sign-up and health permission are eligible. Ignore steps already stored from before that. Eligible steps taken while the app is closed are included on the next sync.

For each member and each Dublin day:

```text
dailyPoints = min(floor(verifiedDailySteps / 100), 100)
```

- 100 verified steps earn 1 Brew Point.
- The daily maximum is 100 Brew Points, reached at 10,000 steps. This 10,000-step limit is a provisional cap. Adjust it once the points cost of rewards is known and we can see how members actually use the app, so extra walking still feels worthwhile.
- There is no weekly cap.
- Steps left over below the next 100-step threshold do not roll over to the next day.
- Earned Brew Points stay in the balance until redeemed. Do not expire them in the MVP.

| Verified daily steps | Brew Points |
| -------------------: | ----------: |
|                  950 |           9 |
|                5,000 |          50 |
|               10,000 |         100 |
|               14,000 |         100 |

The day's points are that formula applied to the day's verified step total. A later sync updates that day's entitlement. It must not add another full award on top.

Store only the daily step total, the Dublin day, the source platform, and the sync time. Do not store step samples.

## Rewards list

Without location permission, show all standard offers with no distances and no permission prompt. Order them stably, such as by partner name. Do not call that list "Nearby."

If the member grants location permission during redemption, the list may then show distances and sort by proximity.

## Offers

Every standard offer has a Brew Points cost greater than zero. Admins also enter the value or discount that will be copied onto each redemption.

A member may redeem the same offer more than once while they have enough Brew Points and the offer is still available.

An offer may have an optional total quantity and an optional expiry. If neither is set, it stays available until Brew & Move staff pause or remove it.

## Redemption

Redemption is started by the member. Café staff check the confirmation visually and apply the discount on the café till. Brew & Move does not ask staff to use software.

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

The member app may submit a step sync or request a redemption. The admin app may manage partners, locations, offers, and communities. Neither client may set Brew Points, write redemption records, or write Solana records directly.

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
