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

The member app can connect Apple Health or Health Connect and show today’s local-day step total. Sign-up, validation, rewards data, and redemption are not built yet.

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

A day is the calendar day in the member's current device timezone. iOS reads Apple Health and Android reads Health Connect. The app reads the health store's total for the current local day, including steps taken while the app was closed. It stores daily totals rather than individual step samples.

The member explicitly validates a reached milestone before local midnight to convert it into Brew Points. A later validation on the same day awards only the difference to the highest newly reached milestone. An unvalidated day closes at midnight and cannot be recovered. Brew Points already in the balance do not expire.

The provisional milestone ladder is:

| Steps | Brew Points |
| ----: | ----------: |
| 2,500 | 25 |
| 5,000 | 50 |
| 7,500 | 75 |
| 10,000 | 100 |
| 12,500 | 125 |
| 15,000 | 150 |
| 17,500 | 175 |
| 20,000 | 200 |

Steps below 2,500 do not reach a milestone. The daily maximum is provisionally 200 Brew Points at 20,000 steps. These rates and offer costs are experiments: adjust them after learning what participating businesses will provide to their communities and how members use the product. The current anchor is one specialty coffee, approximately €4.50, for 200 Brew Points.

The same ladder lives in [`apps/mobile/src/features/earning/milestones.ts`](apps/mobile/src/features/earning/milestones.ts). Today reads it for the next milestone and the points it pays. Change the list there rather than duplicating thresholds in screens. Later validation should award from that list. Reprice a coffee on the offer itself; that does not require a new earning formula.

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
