// backend/firebasePush.js

const fs = require('fs');
let admin = null;
let firestore = null;

try {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (saPath && fs.existsSync(saPath)) {
    // Import firebase-admin and initialize app
    admin = require('firebase-admin');
    const serviceAccount = require(saPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
    });

    firestore = admin.firestore();
    console.log('✅ Firebase Admin initialized (Firestore enabled).');
  } else {
    console.warn('⚠️ Firebase service account not found. Firebase pushes disabled.');
  }
} catch (err) {
  console.warn('⚠️ Firebase init failed:', err.message);
  firestore = null;
}

// -------------------- Push Generic Metric --------------------
async function pushMetric(docPath, payload) {
  if (!firestore) return;
  try {
    await firestore.doc(docPath).set(payload, { merge: true });
    // console.log(`Pushed metric to ${docPath}`);
  } catch (e) {
    console.warn('⚠️ Failed to push metric to Firebase:', e.message);
  }
}

// -------------------- Push RFM Segments --------------------
async function pushRfm(segments) {
  if (!firestore) return;

  // Convert ObjectId to string and sanitize dates
  const sanitized = segments.map(s => ({
    customerId: String(s.customerId),
    lastOrderDate: s.lastOrderDate ? new Date(s.lastOrderDate) : null,
    recencyDays: s.recencyDays,
    frequency: s.frequency,
    monetary: s.monetary,
    rScore: s.rScore,
    fScore: s.fScore,
    mScore: s.mScore,
    rfmScore: s.rfmScore
  }));

  await pushMetric('dashboards/rfm', { updatedAt: new Date(), segments: sanitized });
}

// -------------------- Push CLV Segments --------------------
async function pushClv(clvSegments) {
  if (!firestore) return;

  const sanitized = clvSegments.map(s => ({
    customerId: String(s.customerId),
    lastOrderDate: s.lastOrderDate ? new Date(s.lastOrderDate) : null,
    frequency: s.frequency,
    totalValue: s.totalValue,
    avgOrderValue: s.avgOrderValue,
    clv: s.clv
  }));

  await pushMetric('dashboards/clv', { updatedAt: new Date(), segments: sanitized });
}

// -------------------- Push NPS Result --------------------
async function pushNps(npsResult) {
  if (!firestore) return;

  const payload = {
    updatedAt: new Date(),
    total: npsResult.total || 0,
    promoters: npsResult.promoters || 0,
    passives: npsResult.passives || 0,
    detractors: npsResult.detractors || 0,
    promotersPct: Number((npsResult.promotersPct || 0).toFixed(2)),
    detractorsPct: Number((npsResult.detractorsPct || 0).toFixed(2)),
    npsScore: Number((npsResult.npsScore || 0).toFixed(2))
  };

  await pushMetric('dashboards/nps', payload);
}

// -------------------- Export --------------------
module.exports = { pushRfm, pushClv, pushNps, pushMetric };
