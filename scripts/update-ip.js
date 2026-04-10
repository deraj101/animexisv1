const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Gets the current local network IPv4 address.
 * Favors Wi-Fi and Ethernet (enX, ethX, Wireless, etc.)
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Potential interface names (OS-dependent)
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // family: 'IPv4' or 4 depending on Node version
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        candidates.push(iface.address);
      }
    }
  }

  // Return the first candidate or fallback to localhost
  return candidates[0] || '127.0.0.1';
}

const localIP = getLocalIP();
const envPath = path.join(__dirname, '..', '.env');

console.log(`🔍 Detected Local IP: ${localIP}`);

try {
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const apiURL = `http://${localIP}:3000`;
  const key = 'EXPO_PUBLIC_API_URL';
  const newValue = `${key}=${apiURL}`;

  let updatedContent;
  const regex = new RegExp(`^${key}=.*`, 'm');

  if (regex.test(envContent)) {
    updatedContent = envContent.replace(regex, newValue);
    console.log(`✅ Updated existing ${key} to ${apiURL}`);
  } else {
    updatedContent = envContent ? `${envContent.trim()}\n${newValue}\n` : `${newValue}\n`;
    console.log(`➕ Added ${key}=${apiURL} to .env`);
  }

  fs.writeFileSync(envPath, updatedContent, 'utf8');
  console.log('✨ .env file updated successfully!');
} catch (err) {
  console.error('❌ Error updating .env file:', err.message);
  process.exit(1);
}
