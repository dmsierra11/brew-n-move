# Brew & Move

Brew & Move lets members earn Brew Points from verified steps and redeem them at participating cafés. Members use a normal account and a points balance. Solana is the shared rewards ledger behind that balance. Members do not install a wallet, manage a seed phrase, hold SOL, or approve blockchain transactions.

This repository is the product: the member app, the internal admin app, and the shared backend. The marketing waitlist site lives elsewhere.

## Repository

Member and admin apps share one Supabase project.

| Path          | What it is                                                  |
| ------------- | ----------------------------------------------------------- |
| `apps/mobile` | Member app. Expo and TypeScript.                            |
| `apps/admin`  | Internal admin app. Vite, React, and TypeScript.            |
| `supabase`    | Postgres, auth, authorization policies, and Edge Functions. |
| `solana`      | Devnet rewards ledger.                                      |

The apps are still starter screens. Sign-up, step sync, rewards, and redemption are not built yet.

## Prerequisites

- Node.js 20 or later
- [pnpm](https://pnpm.io) 10.26.2 (`packageManager` in the root `package.json`; Corepack will use that version)
- For a local iOS build: Xcode
- For a device development build: an [Expo](https://expo.dev) account

Health integrations need an Expo development build. Expo Go does not include HealthKit or Health Connect.

## Getting started

From the repository root:

```bash
pnpm install
```

Member app (Expo dev server):

```bash
pnpm mobile
```

Admin app (Vite, usually http://localhost:5173):

```bash
pnpm admin
```

iOS development build through EAS:

```bash
pnpm eas:build:ios
```

A local native run, after the iOS project has been generated:

```bash
pnpm --filter mobile ios
```

`apps/mobile/ios` and `apps/mobile/android` are generated. Configure native behavior in `app.json` and config plugins.

## Product

The MVP covers sign-up, step-based earning, a rewards list, community joining, member-initiated in-person redemption, and internal admin management. Joining is a lightweight association in the MVP and does not gate earning or standard rewards.

Members sign up with email and password, Sign in with Apple, or Sign in with Google. Onboarding collects a first name and a display name. The interface shows Brew Points only.

### Earning

A day is the `Europe/Dublin` calendar day. Only steps taken after both sign-up and health permission count. iOS reads Apple HealthKit. Android reads Health Connect. Steps taken while the app is closed count on the next sync.

For each member and each Dublin day:

```text
dailyPoints = min(floor(verifiedDailySteps / 100), 100)
```

100 verified steps earn 1 Brew Point. The daily maximum is 100 Brew Points, at 10,000 steps. That 10,000-step limit is a provisional cap. Adjust it once the points cost of rewards is known and we can see how members actually use the app, so extra walking still feels worthwhile. There is no weekly cap, and leftover steps do not roll into the next day. A later sync updates that day's entitlement. It does not award the day again.

### Redemption

The member starts redemption at the café. Staff check the confirmation on the member's phone and apply the discount on the till. Partners have no login, scanner, or app.

The device must be within 100 metres of the location, and the member must have enough Brew Points. The server deducts the points and records the redemption once. The confirmation stays live for 5 minutes, then shows as expired. The redemption stays completed.

### Server and ledger

Supabase Edge Functions are the entry point for step sync and redemption. Postgres applies each balance change and its record together. Clients do not set Brew Points or write redemption or Solana records.

Solana records points issued, points redeemed, duplicate-redemption prevention, the reward rule, and the history of those events. Step counts and other health data stay off the chain. Brew & Move creates a custodial account per member and sponsors fees.

## Later

These are outside the MVP:

- Event attendance rewards
- Community-only rewards and perks
- Partner settlement, balances, reimbursement, invoices, and money movement
- A partner web app or staff confirmation inside Brew & Move
- Point expiration
- Member-specific redemption limits, cooldowns, and member-only rewards

## Open decisions

These are not chosen yet:

- The Solana program framework and the on-chain account layout
- Where custodial signing keys are stored
- How the first admin role is granted
