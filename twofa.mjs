// npm run 2fa            → turn on authenticator-app verification (Google Authenticator, Microsoft Authenticator, ...)
// npm run 2fa off        → turn it off
// npm run 2fa status
import os from 'node:os';
import readline from 'node:readline/promises';
import qrcode from 'qrcode-terminal';
import { totpConfig, newTotpSecret, totpUri, checkTotp, enableTotp, disableTotp } from './auth.mjs';

const cmd = process.argv[2] || 'on';
const cfg = totpConfig();
const rule = days => days
  ? `when pairing a new device, and every ${days} days per device`
  : 'only when pairing a new device';

if (cmd === 'status') {
  console.log(cfg ? `Two-factor: on (${rule(cfg.everyDays)})` : 'Two-factor: off (run npm run 2fa to enable)');
  process.exit(0);
}
if (cmd === 'off') {
  disableTotp();
  console.log('Two-factor disabled.');
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
if (cfg && !/^y/i.test(await rl.question(`Already enabled (${rule(cfg.everyDays)}). Re-bind Authenticator? (y/N) `))) process.exit(0);

const secret = newTotpSecret();
console.log('\n1. Open Authenticator on your phone (Google / Microsoft Authenticator, etc.) and scan this QR code:\n');
qrcode.generate(totpUri(secret, os.hostname().replace(/\.local$/, '')), { small: true });
console.log(`\n   If you cannot scan, enter this secret manually: ${secret}\n`);

let ok = false;
for (let i = 0; i < 3 && !ok; i++) {
  ok = checkTotp(secret, await rl.question('2. Enter the 6-digit code shown in Authenticator: '));
  if (!ok) console.log('   Incorrect — use the code currently displayed.');
}
if (!ok) { console.log('Not enabled.'); process.exit(1); }

const answer = (await rl.question('3. Re-verify each device every how many days? (Enter = 30; 0 = only when pairing a new device) ')).trim();
const everyDays = answer === '' ? 30 : Math.max(0, parseInt(answer, 10) || 0);
enableTotp(secret, everyDays);
console.log(`\nTwo-factor enabled: ${rule(everyDays)}. Already-paired devices start counting from now.`);
rl.close();
