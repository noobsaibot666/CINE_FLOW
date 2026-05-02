const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showHelp() {
    console.log(`
CineFlow Licensing Admin
------------------------
Commands:
  list                - List all licenses
  search <email/key>  - Find license details
  reset <key>         - Clear all activations for a key
  create <email>      - Manually generate a new license
  delete <key>        - Remove license and activations
  exit                - Close admin
    `);
}

function generateKey() {
    return 'CF-' + Math.random().toString(36).substring(2, 6).toUpperCase() + 
           '-' + Math.random().toString(36).substring(2, 6).toUpperCase() +
           '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function start() {
    showHelp();
    
    rl.on('line', (input) => {
        const [cmd, ...args] = input.trim().split(' ');
        
        switch (cmd) {
            case 'list':
                db.all('SELECT * FROM licenses', (err, rows) => {
                    console.table(rows);
                });
                break;

            case 'search':
                const query = args[0];
                db.get('SELECT * FROM licenses WHERE email = ? OR license_key = ?', [query, query], (err, row) => {
                    if (!row) return console.log('Not found.');
                    console.log('\n--- License Details ---');
                    console.log(row);
                    db.all('SELECT * FROM activations WHERE license_id = ?', [row.id], (err, acts) => {
                        console.log('Activations:', acts.length, '/ 2');
                        console.table(acts);
                    });
                });
                break;

            case 'reset':
                const keyToReset = args[0];
                db.get('SELECT id FROM licenses WHERE license_key = ?', [keyToReset], (err, row) => {
                    if (!row) return console.log('Key not found.');
                    db.run('DELETE FROM activations WHERE license_id = ?', [row.id], (err) => {
                        console.log(`Reset all activations for ${keyToReset}`);
                    });
                });
                break;

            case 'create':
                const emailToCreate = args[0];
                const newKey = generateKey();
                db.run('INSERT INTO licenses (license_key, email) VALUES (?, ?)', [newKey, emailToCreate], (err) => {
                    if (err) return console.error(err.message);
                    console.log(`Created new license: ${newKey} for ${emailToCreate}`);
                    
                    const { sendLicenseEmail } = require('./mailer');
                    sendLicenseEmail(emailToCreate, newKey)
                        .then(() => console.log('License email sent.'))
                        .catch(err => console.error('Failed to send email:', err.message));
                });
                break;

            case 'help':
                showHelp();
                break;

            case 'exit':
                db.close();
                process.exit(0);
                break;

            default:
                console.log('Unknown command. Type "help"');
        }
    });
}

start();
