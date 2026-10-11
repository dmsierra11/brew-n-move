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

The app opens without an account. Guests can connect Apple Health or Health Connect, view today’s step total, and browse offers. Validating steps and redemption require a signed-in member who has finished onboarding. The demo signs in with email and password. Validation, rewards data, and redemption are not built yet.

## Prerequisites

- Node.js 20 or later
- [pnpm](https://pnpm.io) 10.26.2 (`packageManager` in the root `package.json`; Corepack will use that version)
- For a local iOS build: Xcode
- For a device development build: an [Expo](https://expo.dev) account

Health integrations need an Expo development build. Expo Go does not include HealthKit or Health Connect.

## Getting started

The member app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `apps/mobile/.env`. Copy `apps/mobile/.env.example` and fill in the hosted project values. Do not commit that file or a service-role key. The hosted project is Brew & Move in Maurique Labs (`eqkhuekmhixivwiswwcx`, eu-west-1). In Authentication, Confirm email stays off. Sign-up also confirms the Auth login email so a session can start even if that toggle is still on. After onboarding, the app sends a verification email. Set `RESEND_API_KEY` and `EMAIL_FROM` as Edge Function secrets (`supabase/functions/.env.example`). An unconfirmed address does not block onboarding or step validation.

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

`apps/mobile/ios` and `apps/mobile/android` are generated. Configure native behavior in `app.json` and config plugins.

### Physical iPhone

Expo Go cannot run this app. HealthKit needs a development build. Register the phone once before the first iOS cloud build:

```bash
pnpm eas:device
```

Then:

```bash
pnpm eas:build:ios
```

When the build finishes, open the install link on the iPhone in Safari, or scan the QR that EAS prints. The Metro QR code does not install the app; it only loads JavaScript into a development build that is already on the phone. A phone registered after that build cannot install it. Register it, then build again.

If iOS blocks the app, go to **Settings → General → VPN & Device Management**, trust the developer certificate, and turn on **Developer Mode** under **Settings → Privacy & Security** if iOS asks (a restart is required). Keep the phone on the same Wi-Fi as the Mac.

Leave `pnpm mobile` running. Opening **Brew & Move** from the Home screen shows a launcher. That screen often cannot discover Metro on its own. Connect with one of these:

1. On the iPhone, open the Camera app and scan the QR code from the Metro terminal. Do not use Expo Go.
2. In the launcher, enter the URL Metro prints, for example `http://192.168.10.49:8081`.
3. If iOS asked, allow **Local Network** for Brew & Move under **Settings → Privacy & Security → Local Network**.

If the phone still cannot reach Metro (guest Wi-Fi, client isolation, or a different network), start a tunnel instead:

```bash
pnpm mobile:tunnel
```

Then scan the new QR code. A tunnel is slower than LAN, but it does not need the phone and Mac to share a local network.

Saving a file reloads the app. Rebuild with `pnpm eas:build:ios` only when native dependencies or `apps/mobile/app.json` change.

A local native run, after the iOS project has been generated:

```bash
pnpm --filter mobile ios
```

### Physical Android

Install Health Connect, enable USB debugging, connect the phone, then:

```bash
pnpm --filter mobile android --device
```

That generates `apps/mobile/android`, builds locally, and installs. A cloud development build:

```bash
pnpm eas:build:android
```

## Product

The MVP covers sign-up, step-based earning, a rewards list, community joining, member-initiated in-person redemption, and internal admin management. Joining is a lightweight association in the MVP and does not gate earning or standard rewards.

Members sign up with email and password, Sign in with Apple, or Sign in with Google. The current demo implements email and password. Sign in with Apple, Sign in with Google, password recovery, and account deletion remain required before production. Onboarding collects a first name and a display name. After onboarding, Brew & Move emails a verification link. Profile shows a reminder with resend until the link is opened. An unconfirmed address does not block step validation. The interface shows Brew Points only.

### Earning

A day is the calendar day in the member's current device timezone. iOS reads Apple Health and Android reads Health Connect. The app reads the health store's total for the current local day, including steps taken while the app was closed. It stores daily totals rather than individual step samples.

The member swipes to validate a reached milestone before local midnight. A later validation on the same day awards only the difference to the highest newly reached milestone. An unvalidated day closes at midnight and cannot be recovered. Brew Points already in the balance do not expire.

Each validation owns the absolute window from local midnight to the next local midnight. Overlap uses those instants, not the timezone name. Adjacent windows stay eligible. An overlapping window awards nothing and cannot be partially paid, because step samples are not stored. The server records the submitted daily total and does not read Apple Health or Health Connect.

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

The same ladder lives in [`apps/mobile/src/features/earning/milestones.ts`](apps/mobile/src/features/earning/milestones.ts). Today and the validation function both award from that list. Change the list there, and keep the server ladder in step with it. Reprice a coffee on the offer itself; that does not require a new earning formula.

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
