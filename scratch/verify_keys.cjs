const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env manually to avoid dependencies
const envPath = path.join(__dirname, '..', 'licensing-server', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const privMatch = env.match(/PRIVATE_KEY_B64=(.*)/);
const privateKeyB64 = privMatch ? privMatch[1].trim() : null;

if (!privateKeyB64) {
    console.error('Private key not found in .env');
    process.exit(1);
}

try {
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(privateKeyB64, 'base64'),
        format: 'der',
        type: 'pkcs8'
    });

    const publicKey = crypto.createPublicKey(privateKey);
    const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    console.log('--- Key Verification ---');
    console.log('Derived Public Key (B64):', publicKeyB64);
    
    // Check against license.rs
    const rustPath = path.join(__dirname, '..', 'src-tauri', 'src', 'license.rs');
    const rustCode = fs.readFileSync(rustPath, 'utf8');
    const pubMatch = rustCode.match(/const PUBLIC_KEY_B64: &str = "(.*)";/);
    const existingPubKeyB64 = pubMatch ? pubMatch[1] : null;

    console.log('Existing Public Key in license.rs:', existingPubKeyB64);

    if (publicKeyB64 === existingPubKeyB64) {
        console.log('\nSUCCESS: Keys match!');
    } else {
        console.log('\nFAILURE: Keys do NOT match!');
    }
} catch (err) {
    console.error('Error during verification:', err.message);
}
