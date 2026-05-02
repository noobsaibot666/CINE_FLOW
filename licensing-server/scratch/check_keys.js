const crypto = require('crypto');

const privateKeyB64 = 'MC4CAQAwBQYDK2VwBCIEINioNrNTT9smGhF5Yz8eJJ45xHdC+Nls9pZfY6ouwwlM';
const publicKeyB64 = 'MCowBQYDK2VwAyEAS+kAH4Md2krdn1DeoveStSFn+hIQCvNE8pp5nK5vt9U=';

try {
    const priv = crypto.createPrivateKey({
        key: Buffer.from(privateKeyB64, 'base64'),
        format: 'der',
        type: 'pkcs8'
    });

    const pub = crypto.createPublicKey(priv);
    const derivedPubB64 = pub.export({ format: 'der', type: 'spki' }).toString('base64');

    console.log('Expected Public Key:', publicKeyB64);
    console.log('Derived Public Key: ', derivedPubB64);

    if (publicKeyB64 === derivedPubB64) {
        console.log('MATCH: Key pair is valid.');
    } else {
        console.log('ERROR: Key pair MISMATCH!');
    }
} catch (e) {
    console.error('Error:', e.message);
}
