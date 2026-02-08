/**
 * Deletes all documents in hawkerCentres and foodStalls collections.
 *
 * Usage:
 *   cd functions && node ../scripts/cleanupData.js
 *
 * Requires: firebase-admin (already installed in functions/)
 * Auth: uses Application Default Credentials — run `gcloud auth application-default login` first,
 *        or set GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON.
 */

const admin = require("firebase-admin");

admin.initializeApp({ projectId: "hawkr-0" });
const db = admin.firestore();

async function deleteCollection(collectionPath) {
  const snapshot = await db.collection(collectionPath).get();
  if (snapshot.empty) {
    console.log(`  ${collectionPath}: already empty`);
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`  ${collectionPath}: deleted ${snapshot.size} documents`);
  return snapshot.size;
}

async function main() {
  console.log("Cleaning up Firestore data...\n");

  const collections = ["hawkerCentres", "foodStalls"];
  let total = 0;

  for (const col of collections) {
    total += await deleteCollection(col);
  }

  console.log(`\nDone. ${total} documents deleted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
