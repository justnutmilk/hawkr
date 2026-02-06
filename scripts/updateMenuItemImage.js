/**
 * Quick script to update a menu item's imageUrl in Firestore
 *
 * Run with: node scripts/updateMenuItemImage.js
 *
 * Note: This requires firebase-admin. If not installed, run:
 * npm install firebase-admin
 *
 * You also need a service account key file. Download from:
 * Firebase Console > Project Settings > Service Accounts > Generate New Private Key
 * Save as: firebase-service-account.json in the project root
 */

const admin = require('firebase-admin');

// Initialize with your service account
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateMenuItemImage(stallId, menuItemId, imageUrl) {
  try {
    await db
      .collection('foodStalls')
      .doc(stallId)
      .collection('menuItems')
      .doc(menuItemId)
      .update({ imageUrl: imageUrl });

    console.log(`Updated imageUrl for menu item ${menuItemId}`);
  } catch (error) {
    console.error('Error updating menu item:', error);
  }
}

// Update Hokkien Mee
updateMenuItemImage(
  'LvkB9truvRTLwRbG8nAM',
  'V0odVa56VVhv0brqtkKX',
  'https://firebasestorage.googleapis.com/v0/b/hawkr-0.firebasestorage.app/o/stalls%2FLvkb9truvRTLwRbG8nAM%2Fmenu%2FV0odVa56VVhv0brqtkKX.png?alt=media&token=634ee39a-fc55-4de6-a066-720600609c28'
).then(() => {
  console.log('Done!');
  process.exit(0);
});
