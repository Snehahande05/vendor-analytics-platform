// --- Dependencies ---
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto'); 
const admin = require('firebase-admin');

// --- Configuration and Initialization ---
const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- MongoDB Setup ---
// WARNING: Replace this with your actual connection URI if it has changed
const MONGO_URI = 'mongodb+srv://snehahande175_db_user:i4AMHMpkAjoZQJIA@vendorcluster.aoghxop.mongodb.net/?retryWrites=true&w=majority&appName=vendorCluster'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('[MongoDB] Connected successfully'))
    .catch(err => console.error('[MongoDB] Connection error:', err));

// MongoDB Schemas
const CustomerSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    // Hash is used for deduplication based on customer data
    hash: { type: String, unique: true, required: true } 
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
    customerName: String,
    productName: String, 
    quantity: Number,
    amount: Number, 
    status: { type: String, enum: ['Processing', 'Completed', 'Cancelled'], default: 'Processing' }, 
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Customer = mongoose.model('Customer', CustomerSchema);
const Order = mongoose.model('Order', OrderSchema);

// --- Firebase Setup (For Inventory, NPS, and Leads) ---
// NOTE: Ensure your private_key is correctly formatted with the escaped newlines.
const serviceAccount = {
    "type": "service_account",
    "project_id": "vendor-analytics-firebase", 
    "private_key_id": "fedbbc5ce5fed07ea5f5026f4d84c0cd396431dd",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCq1IWzTc8GvuZI\nrVel3gnjpEM1qpJ019maYKpkqyo74ipCaT/t2FaX+CdRPKjSOkvFtjj18aKk99f6\nvdqQXPFORa2vz24kUSoBBFkZd4i6oBw4yMsfE9aqvNeAXpcgVvFbUnCQP1RcEaCd\nCrvpbptSIujJW7rTbWwhr2abCQ5kWBP8ihoJGCaAno5bTxzSpVBpVZ2qwjfoigjP\nAwOjqS4JL1gLBWy+pM7clmbXVulJ0bs26VeHLVBtmHUOeMMEMpYGDbolCni8McWI\nuEEpcZDfgOnaeZS5pELlIE/2GnO0nVFhPn6Bwqa+W2pn0lh9iWVO+GLZIj4yK1pE\nDiF3snDhAgMBAAECgf9FQnodLXliIsOlc6IK0vBE0F7vbdiIcXr9PB6D8gw4Jdnm\n/a+4SUh9FKncJdvMYBZDHT4QI4eYRWPWJQ3Cuevw8A8bLd5Z8GGOI1avHJIywqID\n47ohP3R+hKcFRKnA/X7yp4SQ9xwct94xIsj3kKsoVz70ubFlRwKFewz+jmK8tiTR\nKCB7xI/ILa4Wka+Xql7MozHBiaEqKI3wsnNeJ3hzH9DiU07+x3Vs3y8r/cYoDh2y\nmHf0m/FjU2JmhICaFutxBV9v3rYciY76IS0UYPAW+LT5HizPIqyfj8Wxcm4fNETN\nz1gxN64XDVTZZxD/jyflHCaVMH3mC9ykyHpEZlkCgYEA0kGwL64Ma7vF/oaaCysl\nET/amH2uK7o6yJnAVa10DAvhG/zq7QI7Ew/ba7h3oKK2a4NhcmTIjGKU28II2QKS\naID3rgYaPHjvQThHx7dVYTh0LKmlE1JAHNwgbYGR/74/6d+FGhasbByrAjpeOeYm\nHtGzT/0b/ETVD2RQE0355UkCgYEAz/73PY/SK3zUIjy2csjbSj68Fs6TC5REOk/6\nFbPD3jaffK1A+T3KJIgwloD+3WhTD1xFZ2xm3b4YnIsPcn+ZwLZ1kU/FoYl0dHO9\nRuF6//FEh+MN5ZRBWbT367FYkPqofZUObY82Mnk96Mfaex+OeD2DcfXNjNW1bnpC\nVFVkZtkCgYEAkmqYDLwBfkyGtpZ5U2m6KGb1DNgIn/7RzLv1CjT96R2kp17bIi05\ngi66uCr/c2eb7QbSp1yzo79KtjZK/wQhfJDC6fbp8k6tHhfZNKTg2hD8JdYFVI0k\nhHRuSJPAXf3YeD7la6N6ctcL50NKNruktDWHzx4NjQFJ9av/b1IPwbECgYEAvgXw\nF1wn5PccT1MsVF3QiloaOLPtf2yrkKK0ldMwJPm+Z4dZjtu2q/2IdlfPgLPo/mWM\nOtq8d+VOUuZw7GhLLdcEPgelRNlxfVqoF/O0DdR8ibEUZyQ1OCGvRrM1eO6ntGPT\nVKC8IQzHVL4Rit7fqFZ6mki4y+wK363un2GMYrECgYEAyPUvaF7yWLzSoivzuHPG\n/YMTqCFkBUhtQEfjYGpY7V7fLO502k2fMEjuIuWkEpR3LS3qvJ53RW2I0RSAzkkr\nypfu3t6qcEmu+as14KEXGetv1v+6SaSdZtBzEFCpI1/0+ZUiYWQ9+um+A35Of5xq\nieBP2mKTLV/j8FOo4Cw7nMk=\n-----END PRIVATE KEY-----\n", 
    "client_email": "firebase-adminsdk-fbsvc@vendor-analytics-firebase.iam.gserviceaccount.com",
    "client_id": "113660118747297503741",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40vendor-analytics-firebase.iam.gserviceaccount.com"
};

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log('[Firebase] Initialized successfully');
    }
} catch (error) {
    if (!admin.apps.length) { 
        console.error('[Firebase] Initialization failed (CRITICAL):', error.message);
        console.error('*** Check that your FIREBASE_PRIVATE_KEY is correctly formatted in server.js ***');
    }
}

// Only proceed if Firebase was successfully initialized
const db = (admin.apps.length > 0) ? admin.firestore() : null;

// --- Data Structures and Algorithms In-Memory Storage & Logic ---

// 1. Leads (Priority Queue Simulation Logic)
const getLeadPriority = (source, status) => {
    // Qualified leads have highest priority (2)
    if (status === 'Qualified') return 2;
    // Leads from high-value sources (website, referral) have medium priority (1)
    if (source === 'website' || source === 'referral') return 1;
    // Default low priority (0)
    return 0;
};

// 2. Referral Network (Hardcoded Graph for BFS) - ALL LOWERCASE
const referralGraph = {
    'ceo': ['alice smith', 'bob johnson', 'david'],
    'alice smith': ['charlie brown', 'eve williams'],
    'bob johnson': ['frank lee', 'grace hall'],
    'charlie brown': ['heidi kim'],
    'grace hall': ['ivy chen'],
    'david': ['sneha manoj hande'],
    'sneha manoj hande': ['kinjal gawali'],
};

// --- Hashing Utility (for Customer Deduplication) ---
function createHash(name, email, phone) {
    // Creates a unique, case-insensitive hash for deduplication
    const data = `${name.toLowerCase()}:${email.toLowerCase()}:${phone}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

// --- API Routes ---

// Middleware to check if DB is ready for routes that rely on Firebase
const checkFirebaseDb = (req, res, next) => {
    if (!db) {
        console.warn('[Firebase] Attempted API call while Firebase not initialized.');
        return res.status(503).json({ error: 'Firebase is not initialized. Please configure credentials in server.js.' });
    }
    next();
};

// ----------------- LEADS (Firebase & DSA) -----------------
// GET: Load all leads, sorted by priority (Priority Queue Simulation)
app.get('/api/leads', checkFirebaseDb, async (req, res) => {
    try {
        const snapshot = await db.collection('leads').get();
        let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort leads: Qualified > high-source > others
        leads.sort((a, b) => {
            const priorityA = getLeadPriority(a.source, a.status);
            const priorityB = getLeadPriority(b.source, b.status);
            return priorityB - priorityA; 
        });

        res.json({ leads });
    } catch (err) {
        console.error("Lead loading error:", err);
        res.status(500).json({ error: 'Failed to load leads from Firebase.' });
    }
});

// POST: Create a new lead
app.post('/api/leads', checkFirebaseDb, async (req, res) => {
    const { name, email, phone, source } = req.body;
    try {
        const newLead = { 
            name, 
            email, 
            phone, 
            source,
            status: 'Prospect', 
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('leads').add(newLead);
        res.status(201).json({ message: 'Lead created successfully', id: docRef.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit lead to Firebase.' });
    }
});

// POST: Qualify a lead (change status to Qualified)
app.post('/api/leads/qualify/:id', checkFirebaseDb, async (req, res) => {
    const leadId = req.params.id;
    try {
        const docRef = db.collection('leads').doc(leadId);
        await docRef.update({ status: 'Qualified' });
        
        const snapshot = await db.collection('leads').where('status', '==', 'Qualified').get();

        res.json({ message: 'Lead qualified and prioritized.', queueSize: snapshot.size });
    } catch (err) {
        res.status(500).json({ error: 'Failed to qualify lead.' });
    }
});

// POST: Disqualify a lead (change status to Disqualified)
app.post('/api/leads/disqualify/:id', checkFirebaseDb, async (req, res) => {
    const leadId = req.params.id;
    try {
        const docRef = db.collection('leads').doc(leadId);
        await docRef.update({ status: 'Disqualified' });
        res.json({ message: 'Lead disqualified.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to disqualify lead.' });
    }
});

// DELETE Lead
app.delete('/api/leads/:id', checkFirebaseDb, async (req, res) => {
    const leadId = req.params.id;
    try {
        console.log(`[LEAD DELETE] Attempting to delete lead ID: ${leadId}`);
        const docRef = db.collection('leads').doc(leadId);
        await docRef.delete();
        res.json({ message: `Lead ${leadId} deleted successfully.` });
    } catch (err) { 
        console.error("Lead deletion error:", err);
        res.status(500).json({ error: `Failed to delete lead: ${err.message}` }); 
    }
});


// ----------------- CUSTOMERS (MongoDB & Hashing) -----------------
// GET: Load all customers
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await Customer.find().lean();
        res.json({ customers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Add a new customer (with Hashing/Deduplication check)
app.post('/api/customers', async (req, res) => {
    const { name, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    // Deduplication check using a hash of the key fields
    const hash = createHash(name, email || '', phone || '');
    
    try {
        const existingCustomer = await Customer.findOne({ hash });
        if (existingCustomer) {
            return res.status(409).json({ 
                error: `DUPLICATE Customer detected (Hashing Match: ${hash}).`,
                customer: existingCustomer
            });
        }

        const newCustomer = new Customer({ name, email, phone, hash });
        await newCustomer.save();
        res.status(201).json({ message: 'Customer added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update an existing customer (recalculates hash for integrity)
app.put('/api/customers/:id', async (req, res) => {
    const customerId = req.params.id;
    const updates = req.body;
    
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found.' });
        }

        // Apply updates
        const newName = updates.name !== undefined ? updates.name : customer.name;
        const newEmail = updates.email !== undefined ? updates.email : customer.email;
        const newPhone = updates.phone !== undefined ? updates.phone : customer.phone;

        // Recalculate hash based on new data 
        const newHash = createHash(newName, newEmail || '', newPhone || '');

        // Check for hash conflict before saving (unless the hash remains the same)
        if (newHash !== customer.hash) {
            const conflictingCustomer = await Customer.findOne({ hash: newHash, _id: { $ne: customerId } });
            if (conflictingCustomer) {
                 return res.status(409).json({ error: 'Update failed: The new data conflicts with an existing customer record (duplicate hash). Check if this customer already exists.' });
            }
             // Update the hash only if it's new and doesn't conflict
            customer.hash = newHash; 
        }

        // Update customer properties 
        customer.name = newName;
        customer.email = newEmail;
        customer.phone = newPhone;
        
        await customer.save();

        res.json({ message: `Customer ${customerId} updated successfully.`, customer });
    } catch (err) {
        console.error("Customer update error:", err);
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Update failed: The new data conflicts with an existing customer record (duplicate hash).' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Delete an existing customer
app.delete('/api/customers/:id', async (req, res) => {
    const customerId = req.params.id;

    try {
        const result = await Customer.findByIdAndDelete(customerId);
        
        if (!result) {
            return res.status(404).json({ error: 'Customer not found.' });
        }

        res.json({ message: `Customer ${customerId} deleted successfully.` });
    } catch (err) {
        console.error("Customer deletion error:", err);
        res.status(500).json({ error: err.message });
    }
});


// ----------------- INVENTORY (Firebase) -----------------
// GET: Load all inventory
app.get('/api/inventory', checkFirebaseDb, async (req, res) => {
    try {
        const snapshot = await db.collection('inventory').get();
        // Filter out documents that are likely corrupted (missing 'name' or 'stock')
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.name && typeof item.stock === 'number');
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load inventory from Firebase.' });
    }
});

// POST: Add or set inventory stock
app.post('/api/inventory', checkFirebaseDb, async (req, res) => {
    const { name, stock } = req.body;
    const parsedStock = parseInt(stock);

    if (!name || isNaN(parsedStock)) {
        return res.status(400).json({ error: 'Product name and valid stock quantity are required.' });
    }
    
    try {
        // Check if item already exists by name
        const snapshot = await db.collection('inventory').where('name', '==', name).limit(1).get();
        
        if (!snapshot.empty) {
            // Update existing item
            const docId = snapshot.docs[0].id;
            const docRef = db.collection('inventory').doc(docId);
            await docRef.update({ stock: parsedStock });
            res.json({ message: `Inventory for ${name} updated.` });
        } else {
            // Add new item
            await db.collection('inventory').add({ name, stock: parsedStock });
            res.status(201).json({ message: `New inventory item ${name} added.` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update stock quantity
app.put('/api/inventory/:id', checkFirebaseDb, async (req, res) => {
    const docId = req.params.id;
    const { stock } = req.body;
    const parsedStock = parseInt(stock);

    if (isNaN(parsedStock)) {
        return res.status(400).json({ error: 'Valid stock quantity is required.' });
    }

    try {
        const docRef = db.collection('inventory').doc(docId);
        await docRef.update({ stock: parsedStock });
        res.json({ message: 'Inventory stock updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ----------------- ORDERS (MongoDB with Inventory Update/Check in Firebase) -----------------
// GET: Load all orders (filtered to show only valid orders)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find({ productName: { $ne: null } }).lean();
        res.json({ orders });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// POST: Add a new order (Checks Firebase stock, updates Firebase, saves to MongoDB)
app.post('/api/orders', checkFirebaseDb, async (req, res) => {
    const { customer, productName, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!customer || !productName || qty <= 0) {
        return res.status(400).json({ error: 'Missing customer, product, or invalid quantity.' });
    }

    try {
        // 1. Check Inventory in Firebase
        const snapshot = await db.collection('inventory').where('name', '==', productName).limit(1).get();
        if (snapshot.empty) {
            return res.status(404).json({ error: `Product "${productName}" not found in inventory.` });
        }
        
        const itemDoc = snapshot.docs[0];
        const currentStock = itemDoc.data().stock;
        const itemId = itemDoc.id;

        if (currentStock < qty) {
            return res.status(400).json({ error: `Insufficient stock for ${productName}. Available: ${currentStock}` });
        }
        
        // 2. Decrease Stock (Non-atomic for simplicity, but crucial for function)
        const docRef = db.collection('inventory').doc(itemId);
        await docRef.update({ stock: currentStock - qty });

        // 3. Create Order in MongoDB
        const newOrder = new Order({ 
            customerName: customer, 
            productName, 
            quantity: qty, 
            amount: Math.floor(Math.random() * 500) + 50, // Random amount
            status: 'Processing' 
        });
        await newOrder.save();
        
        res.status(201).json({ message: 'Order placed successfully and inventory updated.' });
    } catch (err) {
        console.error("Order creation error:", err);
        res.status(500).json({ error: err.message || 'Failed to process order.' });
    }
});

// PUT: Update order status (Simplified, non-atomic update)
app.put('/api/orders/:id/status', async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body; 

    if (!status || !['Processing', 'Completed', 'Cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid or missing status provided.' });
    }

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        // Update the status in MongoDB
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

        res.json({ message: `Order ${orderId} status updated to ${status}.`, order: updatedOrder });
    } catch (err) {
        console.error("Order status update error:", err);
        res.status(500).json({ error: err.message });
    }
});


// ----------------- REFERRAL BFS (DSA) -----------------
function findReferralTier(graph, startNode, targetNode) {
    // Convert target and start nodes to lowercase for case-insensitive search
    const start = startNode.toLowerCase();
    const target = targetNode.toLowerCase();
    
    if (start === target) return 0;

    const queue = [{ node: start, tier: 0 }];
    const visited = new Set([start]);

    while (queue.length > 0) {
        const { node, tier } = queue.shift();

        // Check the graph using the lowercase node name
        if (graph[node]) {
            for (const neighbor of graph[node]) {
                const lowerNeighbor = neighbor.toLowerCase(); 

                if (lowerNeighbor === target) {
                    return tier + 1;
                }
                
                if (!visited.has(lowerNeighbor)) {
                    visited.add(lowerNeighbor);
                    queue.push({ node: lowerNeighbor, tier: tier + 1 });
                }
            }
        }
    }
    return -1; // Not found
}

// GET: Calculate referral depth for a customer
app.get('/api/referrals/depth/:name', (req, res) => {
    const targetName = req.params.name;
    const startNode = 'CEO'; // The root of the referral tree

    const tier = findReferralTier(referralGraph, startNode, targetName);

    if (tier >= 0) {
        res.json({
            message: `${targetName} is on Tier ${tier} of the referral network.`,
            customer: targetName,
            tier: tier,
            graph: referralGraph
        });
    } else {
        res.status(404).json({
            error: `${targetName} not found in the referral graph or is not reachable from ${startNode}.`,
            graph: referralGraph
        });
    }
});

// ----------------- VENDOR PERFORMANCE (DSA - Dynamic Programming: LIS) -----------------
/**
 * Calculates the length of the Longest Increasing Subsequence (LIS) 
 * for a sequence of revenue values. Used as a "Trend Score".
 */
function calculateLIS(salesHistory) {
    if (!salesHistory || salesHistory.length === 0) return 0;

    const values = salesHistory.map(item => item.revenue);
    const n = values.length;
    const dp = Array(n).fill(1); // DP array stores LIS ending at index i
    let maxLIS = 0;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            if (values[i] > values[j]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
        maxLIS = Math.max(maxLIS, dp[i]);
    }

    return maxLIS;
}

app.get('/api/vendor-performance', async (req, res) => {
    try {
        // Hardcoded dummy sales data for LIS calculation
        const monthlySales = [
            { month: 'Jan', revenue: 15000 },
            { month: 'Feb', revenue: 12000 },
            { month: 'Mar', revenue: 18000 },
            { month: 'Apr', revenue: 25000 },
            { month: 'May', revenue: 20000 },
            { month: 'Jun', revenue: 30000 },
        ];
        
        const totalRevenue = monthlySales.reduce((sum, item) => sum + item.revenue, 0);
        const trendScoreLIS = calculateLIS(monthlySales);

        // Simple composite score based on total revenue and LIS score
        const overallVendorScore = Math.floor(totalRevenue / 1000) * trendScoreLIS;

        res.json({
            trendScoreLIS,
            totalRevenue,
            overallVendorScore,
            salesHistory: monthlySales
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Sliding Window for recent sales analysis (last K=3 orders)
app.get('/api/metrics/recent-sales', async (req, res) => {
    try {
        // Find the 5 most recent orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const K = 3; // Sliding window size
        const windowSize = Math.min(K, recentOrders.length);
        
        let recentRevenue = 0;
        let recentQuantity = 0;

        // Sum up metrics for the orders in the window
        for (let i = 0; i < windowSize; i++) {
            recentRevenue += recentOrders[i].amount || 0;
            recentQuantity += recentOrders[i].quantity || 0;
        }

        res.json({
            windowSize: windowSize,
            averageRevenuePerWindow: windowSize > 0 ? (recentRevenue / windowSize).toFixed(2) : 0,
            totalRevenueInWindow: recentRevenue.toFixed(2),
            totalQuantityInWindow: recentQuantity,
            recentOrders: recentOrders.slice(0, windowSize) // Return only the orders in the window
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to calculate recent sales metrics.' });
    }
});


// ----------------- RFM (MongoDB Aggregation) -----------------
app.get('/api/rfm', async (req, res) => {
    const today = new Date();
    try {
        const rfmData = await Order.aggregate([
            {
                $group: {
                    _id: "$customerName",
                    lastOrderDate: { $max: "$createdAt" }, // Recency calculation start point
                    frequency: { $sum: 1 },                 // Frequency (count of orders)
                    monetary: { $sum: "$amount" }           // Monetary (total spend)
                }
            },
            {
                $project: {
                    _id: 0,
                    customer: "$_id",
                    // Calculate Recency in days
                    Recency: { 
                        $divide: [
                            { $subtract: [today, "$lastOrderDate"] },
                            1000 * 60 * 60 * 24 
                        ]
                    },
                    Frequency: "$frequency",
                    Monetary: "$monetary"
                }
            },
            { $sort: { Recency: 1 } } // Sort by most recent first
        ]);

        const cleanedRfmData = rfmData.map(d => ({
            customer: d.customer,
            Recency: Math.round(d.Recency),
            Frequency: d.Frequency,
            Monetary: Math.round(d.Monetary)
        }));

        res.json(cleanedRfmData);
    } catch (err) {
        console.error("RFM Calculation Error:", err);
        res.status(500).json({ error: 'Failed to calculate RFM metrics. Check MongoDB connection.' });
    }
});


// ----------------- CLV (MongoDB Aggregation) -----------------
app.get('/api/clv', async (req, res) => {
    try {
        // Step 1: Calculate Average Order Value (AOV) and Total Customers
        const aggregateResults = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amount" },
                    totalOrders: { $sum: 1 },
                    totalCustomers: { $addToSet: "$customerName" }
                }
            },
            {
                $project: {
                    _id: 0,
                    AOV: { $divide: ["$totalRevenue", "$totalOrders"] },
                    TotalCustomers: { $size: "$totalCustomers" }
                }
            }
        ]);

        const AOV = aggregateResults.length > 0 && aggregateResults[0].AOV ? aggregateResults[0].AOV : 1;
        const TotalCustomers = aggregateResults.length > 0 ? aggregateResults[0].TotalCustomers : 1; 

        // Step 2: Calculate Purchase Frequency (PF)
        const TotalOrders = await Order.countDocuments();
        const PF = TotalCustomers > 0 ? TotalOrders / TotalCustomers : 0;
        
        // Step 3: Get Monetary value per customer (used as Customer Value CV)
        const customerMonetary = await Order.aggregate([
            {
                $group: {
                    _id: "$customerName",
                    monetary: { $sum: "$amount" }
                }
            }
        ]);

        // Step 4: Calculate CLV
        const LifetimeYears = 3;
        const clvData = customerMonetary.map(d => ({
            customer: d._id,
            // CLV simplified formula: (Customer Monetary) / (AOV) * Purchase Frequency * Lifetime
            // We use the customer's total monetary spend as a proxy for the Customer Value component.
            value: Math.round(((d.monetary / AOV) * PF * LifetimeYears) * 100) / 100 
        }));

        res.json(clvData.sort((a, b) => b.value - a.value)); 

    } catch (err) {
        console.error("CLV Calculation Error:", err);
        res.status(500).json({ error: 'Failed to calculate CLV metrics. Check MongoDB connection.' });
    }
});


// ----------------- NPS (Firebase Aggregation & Submission) -----------------

// POST: Submit new NPS feedback
app.post('/api/feedback', checkFirebaseDb, async (req, res) => {
    const { score, comment, customerId } = req.body;
    const numericScore = parseInt(score);

    if (isNaN(numericScore) || numericScore < 0 || numericScore > 10) {
        return res.status(400).json({ error: 'Score must be a number between 0 and 10.' });
    }
    
    try {
        const newFeedback = { 
            score: numericScore, 
            comment: comment || '',
            customerId: customerId || 'anonymous',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('feedback').add(newFeedback);
        res.status(201).json({ message: 'Feedback submitted successfully', id: docRef.id });
    } catch (err) {
        console.error("Feedback submission error:", err);
        res.status(500).json({ error: 'Failed to submit feedback to Firebase.' });
    }
});


// GET: Calculate NPS score
app.get('/api/nps', checkFirebaseDb, async (req, res) => {
    try {
        const snapshot = await db.collection('feedback').get();
        const scores = snapshot.docs.map(doc => doc.data().score);

        if (scores.length === 0) {
            return res.json({ promoters: 0, passives: 0, detractors: 0, total: 0, npsScore: 0, message: 'No feedback data available.' });
        }

        let promoters = 0; 
        let passives = 0;  
        let detractors = 0; 
        const total = scores.length;

        // Categorize scores: Promoters (9-10), Passives (7-8), Detractors (0-6)
        scores.forEach(score => {
            if (score >= 9) {
                promoters++;
            } else if (score >= 7) {
                passives++;
            } else {
                detractors++;
            }
        });

        // NPS Formula: % Promoters - % Detractors
        const npsScore = Math.round(((promoters - detractors) / total) * 100);

        res.json({ promoters, passives, detractors, total, npsScore });

    } catch (err) {
        console.error("NPS Calculation Error:", err);
        res.status(500).json({ error: 'Failed to calculate NPS metrics. Check Firebase permissions.' });
    }
});


// ----------------- Start Server -----------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API endpoints are available under /api/');
});
