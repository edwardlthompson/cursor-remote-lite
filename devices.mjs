// npm run pair            → show a QR / link that pairs one new phone (valid 10 minutes, single use)
// npm run devices         → list paired devices
// npm run devices remove <id>
import qrcode from 'qrcode-terminal';
import { createPairing, appBase, listDevices, removeDevice, totpConfig } from './auth.mjs';

const [cmd = 'list', arg] = process.argv.slice(2);
const fmt = t => t ? new Date(t).toLocaleString(undefined, { hour12: false }) : '-';

if (cmd === 'pair') {
  const base = appBase();
  if (!base) {
    console.log('Phone app address unknown: run npm run setup for a fixed address, or start the service first (npm run public / npm start).');
    process.exit(1);
  }
  const { link, minutes } = createPairing(base);
  console.log(`\nScan with your phone, or open this link on the phone (${minutes} minutes, one device only):\n`);
  qrcode.generate(link, { small: true });
  console.log(`\n${link}\n`);
  if (totpConfig()) console.log('Two-factor is on: you will also enter the 6-digit Authenticator code when pairing.\n');
  console.log('Android app: paste the pairing link in the app, or open the link in a browser and tap "Open in app".');
} else if (cmd === 'remove') {
  if (!arg) { console.log('Usage: npm run devices remove <device-id>'); process.exit(1); }
  console.log(removeDevice(arg) ? `Removed device ${arg}; it disconnects immediately` : `No device found: ${arg}`);
} else {
  const list = listDevices();
  if (!list.length) console.log('No paired devices yet. Run npm run pair to add one.');
  for (const d of list) console.log(`${d.id}  ${d.name.padEnd(24)}  paired ${fmt(d.created)}  last used ${fmt(d.lastSeen)}`);
  if (list.length) console.log('\nRemove a device: npm run devices remove <device-id>');
}
