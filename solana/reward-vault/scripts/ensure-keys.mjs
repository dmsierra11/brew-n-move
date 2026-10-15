import { generateKeyPairSync } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keysDir = join(root, "keys");
const deployDir = process.env.CARGO_TARGET_DIR
  ? join(process.env.CARGO_TARGET_DIR, "deploy")
  : join(root, "target", "deploy");
mkdirSync(keysDir, { recursive: true });
mkdirSync(deployDir, { recursive: true });

const programKey = join(keysDir, "program.json");
if (!existsSync(programKey)) {
  console.error(
    "Missing solana/reward-vault/keys/program.json. Generate a program keypair and set declare_id to its public key.",
  );
  process.exit(1);
}
copyFileSync(programKey, join(deployDir, "reward_vault-keypair.json"));

const deployer = join(keysDir, "deployer.json");
if (!existsSync(deployer)) {
  writeFileSync(deployer, JSON.stringify(Array.from(ed25519Secret())));
}

function ed25519Secret() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const seed = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url");
  const pub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  return Buffer.concat([seed, pub]);
}
