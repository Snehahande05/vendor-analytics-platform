// backend/seed.js
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './.env' });

const uri = process.env.MONGODB_URI;
const DBNAME = process.env.MONGODB_DBNAME || 'vendor_analytics';

if (!uri) {
  console.error('Set MONGODB_URI in .env before running seed.');
  process.exit(1);
}

function leadHash({ name, email, phone }) {
  const key = `${(name||'').toLowerCase().trim()}|${(email||'').toLowerCase().trim()}|${(phone||'').trim()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h*31 + key.charCodeAt(i))|0;
  return Math.abs(h).toString();
}

(async function seed(){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(DBNAME);
  const leads = [
    { name: 'Asha Patil', email: 'asha@example.com', phone: '9876543210', source:'facebook' },
    { name: 'Manku Nivedita', email: 'nivedita@example.com', phone: '9998887770', source:'college fair' },
    { name: 'Kinjal', email: 'kinjal@example.com', phone: '9123456780', source:'referral' },
  ].map(l => ({ ...l, hash: leadHash(l), stage: 'prospect', score: 0, createdAt: new Date(), lastInteractionAt: new Date(), interactions: [] }));

  await db.collection('leads').deleteMany({});
  const r = await db.collection('leads').insertMany(leads);
  console.log('Seeded leads:', r.insertedCount);
  await client.close();
})();
