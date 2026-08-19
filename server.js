// ============================================================
// VENDOR ANALYTICS PLATFORM - SERVER
// ============================================================

// --- Dependencies ---
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const admin = require('firebase-admin');

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

// Render provides PORT automatically.
// 8080 is used when running locally.
const PORT = process.env.PORT || 8080;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(bodyParser.json());

// Serve frontend files from the project directory
app.use(express.static(__dirname));

// Serve index.html at /
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// MONGODB SETUP
// ============================================================

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('[MongoDB] MONGO_URI environment variable is missing.');
} else {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('[MongoDB] Connected successfully');
        })
        .catch(err => {
            console.error('[MongoDB] Connection error:', err);
        });
}

// ============================================================
// MONGODB SCHEMAS
// ============================================================

const CustomerSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,

    // Hash used for customer deduplication
    hash: {
        type: String,
        unique: true,
        required: true
    }

}, {
    timestamps: true
});

const OrderSchema = new mongoose.Schema({
    customerName: String,
    productName: String,
    quantity: Number,
    amount: Number,

    status: {
        type: String,
        enum: ['Processing', 'Completed', 'Cancelled'],
        default: 'Processing'
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

const Customer = mongoose.model('Customer', CustomerSchema);
const Order = mongoose.model('Order', OrderSchema);

// ============================================================
// FIREBASE SETUP
// ============================================================

let db = null;

try {

    const requiredFirebaseVariables = [
        'FIREBASE_TYPE',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID',
        'FIREBASE_AUTH_URI',
        'FIREBASE_TOKEN_URI',
        'FIREBASE_AUTH_PROVIDER_CERT_URL',
        'FIREBASE_CLIENT_CERT_URL'
    ];

    const missingFirebaseVariables = requiredFirebaseVariables.filter(
        variable => !process.env[variable]
    );

    if (missingFirebaseVariables.length > 0) {

        console.error(
            '[Firebase] Missing environment variables:',
            missingFirebaseVariables.join(', ')
        );

    } else {

        const serviceAccount = {
            type: process.env.FIREBASE_TYPE,

            project_id: process.env.FIREBASE_PROJECT_ID,

            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,

            private_key: process.env.FIREBASE_PRIVATE_KEY
                .replace(/\\n/g, '\n'),

            client_email: process.env.FIREBASE_CLIENT_EMAIL,

            client_id: process.env.FIREBASE_CLIENT_ID,

            auth_uri: process.env.FIREBASE_AUTH_URI,

            token_uri: process.env.FIREBASE_TOKEN_URI,

            auth_provider_x509_cert_url:
                process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,

            client_x509_cert_url:
                process.env.FIREBASE_CLIENT_CERT_URL
        };

        if (!admin.apps.length) {

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });

        }

        db = admin.firestore();

        console.log('[Firebase] Initialized successfully');
    }

} catch (error) {

    console.error(
        '[Firebase] Initialization failed:',
        error.message
    );

    db = null;
}

// ============================================================
// FIREBASE DATABASE CHECK
// ============================================================

const checkFirebaseDb = (req, res, next) => {

    if (!db) {

        console.warn(
            '[Firebase] API request received but Firebase is not initialized.'
        );

        return res.status(503).json({
            error: 'Firebase is not initialized. Check Render environment variables.'
        });
    }

    next();
};

// ============================================================
// DATA STRUCTURES & ALGORITHMS
// ============================================================

// ------------------------------------------------------------
// 1. PRIORITY QUEUE - LEADS
// ------------------------------------------------------------

const getLeadPriority = (source, status) => {

    // Qualified leads = highest priority
    if (status === 'Qualified') {
        return 2;
    }

    // Website/referral leads = medium priority
    if (
        source === 'website' ||
        source === 'referral'
    ) {
        return 1;
    }

    // Other leads
    return 0;
};

// ------------------------------------------------------------
// 2. GRAPH - REFERRAL NETWORK
// ------------------------------------------------------------

const referralGraph = {

    'ceo': [
        'alice smith',
        'bob johnson',
        'david'
    ],

    'alice smith': [
        'charlie brown',
        'eve williams'
    ],

    'bob johnson': [
        'frank lee',
        'grace hall'
    ],

    'charlie brown': [
        'heidi kim'
    ],

    'grace hall': [
        'ivy chen'
    ],

    'david': [
        'sneha manoj hande'
    ],

    'sneha manoj hande': [
        'kinjal gawali'
    ]
};

// ------------------------------------------------------------
// HASHING UTILITY
// ------------------------------------------------------------

function createHash(name, email, phone) {

    const data =
        `${name.toLowerCase()}:${email.toLowerCase()}:${phone}`;

    return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
}

// ============================================================
// LEADS - FIREBASE
// ============================================================

// GET ALL LEADS
app.get('/api/leads', checkFirebaseDb, async (req, res) => {

    try {

        const snapshot =
            await db.collection('leads').get();

        let leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Priority Queue simulation
        leads.sort((a, b) => {

            const priorityA =
                getLeadPriority(a.source, a.status);

            const priorityB =
                getLeadPriority(b.source, b.status);

            return priorityB - priorityA;
        });

        res.json({
            leads
        });

    } catch (err) {

        console.error(
            '[Leads] Loading error:',
            err
        );

        res.status(500).json({
            error: 'Failed to load leads from Firebase.'
        });
    }
});

// CREATE LEAD
app.post('/api/leads', checkFirebaseDb, async (req, res) => {

    const {
        name,
        email,
        phone,
        source
    } = req.body;

    try {

        const newLead = {

            name,
            email,
            phone,
            source,

            status: 'Prospect',

            createdAt:
                admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef =
            await db.collection('leads').add(newLead);

        res.status(201).json({
            message: 'Lead created successfully',
            id: docRef.id
        });

    } catch (err) {

        console.error(
            '[Leads] Create error:',
            err
        );

        res.status(500).json({
            error: 'Failed to submit lead to Firebase.'
        });
    }
});

// QUALIFY LEAD
app.post(
    '/api/leads/qualify/:id',
    checkFirebaseDb,
    async (req, res) => {

        const leadId = req.params.id;

        try {

            const docRef =
                db.collection('leads').doc(leadId);

            await docRef.update({
                status: 'Qualified'
            });

            const snapshot =
                await db
                    .collection('leads')
                    .where('status', '==', 'Qualified')
                    .get();

            res.json({
                message: 'Lead qualified and prioritized.',
                queueSize: snapshot.size
            });

        } catch (err) {

            console.error(
                '[Leads] Qualify error:',
                err
            );

            res.status(500).json({
                error: 'Failed to qualify lead.'
            });
        }
    }
);

// DISQUALIFY LEAD
app.post(
    '/api/leads/disqualify/:id',
    checkFirebaseDb,
    async (req, res) => {

        const leadId = req.params.id;

        try {

            const docRef =
                db.collection('leads').doc(leadId);

            await docRef.update({
                status: 'Disqualified'
            });

            res.json({
                message: 'Lead disqualified.'
            });

        } catch (err) {

            console.error(
                '[Leads] Disqualify error:',
                err
            );

            res.status(500).json({
                error: 'Failed to disqualify lead.'
            });
        }
    }
);

// DELETE LEAD
app.delete(
    '/api/leads/:id',
    checkFirebaseDb,
    async (req, res) => {

        const leadId = req.params.id;

        try {

            console.log(
                `[LEAD DELETE] Attempting to delete lead ID: ${leadId}`
            );

            const docRef =
                db.collection('leads').doc(leadId);

            await docRef.delete();

            res.json({
                message:
                    `Lead ${leadId} deleted successfully.`
            });

        } catch (err) {

            console.error(
                '[Leads] Delete error:',
                err
            );

            res.status(500).json({
                error:
                    `Failed to delete lead: ${err.message}`
            });
        }
    }
);

// ============================================================
// CUSTOMERS - MONGODB
// ============================================================

// GET CUSTOMERS
app.get('/api/customers', async (req, res) => {

    try {

        const customers =
            await Customer.find().lean();

        res.json({
            customers
        });

    } catch (err) {

        console.error(
            '[Customers] Load error:',
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

// CREATE CUSTOMER
app.post('/api/customers', async (req, res) => {

    const {
        name,
        email,
        phone
    } = req.body;

    if (!name) {

        return res.status(400).json({
            error: 'Name is required.'
        });
    }

    const hash =
        createHash(
            name,
            email || '',
            phone || ''
        );

    try {

        const existingCustomer =
            await Customer.findOne({
                hash
            });

        if (existingCustomer) {

            return res.status(409).json({

                error:
                    `DUPLICATE Customer detected (Hashing Match: ${hash}).`,

                customer:
                    existingCustomer
            });
        }

        const newCustomer =
            new Customer({
                name,
                email,
                phone,
                hash
            });

        await newCustomer.save();

        res.status(201).json({
            message:
                'Customer added successfully.'
        });

    } catch (err) {

        console.error(
            '[Customers] Create error:',
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

// UPDATE CUSTOMER
app.put('/api/customers/:id', async (req, res) => {

    const customerId = req.params.id;
    const updates = req.body;

    try {

        const customer =
            await Customer.findById(customerId);

        if (!customer) {

            return res.status(404).json({
                error: 'Customer not found.'
            });
        }

        const newName =
            updates.name !== undefined
                ? updates.name
                : customer.name;

        const newEmail =
            updates.email !== undefined
                ? updates.email
                : customer.email;

        const newPhone =
            updates.phone !== undefined
                ? updates.phone
                : customer.phone;

        const newHash =
            createHash(
                newName,
                newEmail || '',
                newPhone || ''
            );

        if (newHash !== customer.hash) {

            const conflictingCustomer =
                await Customer.findOne({
                    hash: newHash,
                    _id: { $ne: customerId }
                });

            if (conflictingCustomer) {

                return res.status(409).json({
                    error:
                        'Update failed: The new data conflicts with an existing customer record.'
                });
            }

            customer.hash = newHash;
        }

        customer.name = newName;
        customer.email = newEmail;
        customer.phone = newPhone;

        await customer.save();

        res.json({

            message:
                `Customer ${customerId} updated successfully.`,

            customer
        });

    } catch (err) {

        console.error(
            '[Customers] Update error:',
            err
        );

        if (err.code === 11000) {

            return res.status(409).json({
                error:
                    'Update failed: Duplicate customer record.'
            });
        }

        res.status(500).json({
            error: err.message
        });
    }
});

// DELETE CUSTOMER
app.delete('/api/customers/:id', async (req, res) => {

    const customerId = req.params.id;

    try {

        const result =
            await Customer.findByIdAndDelete(customerId);

        if (!result) {

            return res.status(404).json({
                error: 'Customer not found.'
            });
        }

        res.json({
            message:
                `Customer ${customerId} deleted successfully.`
        });

    } catch (err) {

        console.error(
            '[Customers] Delete error:',
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

// ============================================================
// INVENTORY - FIREBASE
// ============================================================

// GET INVENTORY
app.get('/api/inventory', checkFirebaseDb, async (req, res) => {

    try {

        const snapshot =
            await db.collection('inventory').get();

        const items =
            snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(
                    item =>
                        item.name &&
                        typeof item.stock === 'number'
                );

        res.json({
            items
        });

    } catch (err) {

        console.error(
            '[Inventory] Load error:',
            err
        );

        res.status(500).json({
            error:
                'Failed to load inventory from Firebase.'
        });
    }
});

// CREATE / UPDATE INVENTORY
app.post(
    '/api/inventory',
    checkFirebaseDb,
    async (req, res) => {

        const {
            name,
            stock
        } = req.body;

        const parsedStock =
            parseInt(stock);

        if (
            !name ||
            isNaN(parsedStock)
        ) {

            return res.status(400).json({
                error:
                    'Product name and valid stock quantity are required.'
            });
        }

        try {

            const snapshot =
                await db
                    .collection('inventory')
                    .where('name', '==', name)
                    .limit(1)
                    .get();

            if (!snapshot.empty) {

                const docId =
                    snapshot.docs[0].id;

                const docRef =
                    db
                        .collection('inventory')
                        .doc(docId);

                await docRef.update({
                    stock: parsedStock
                });

                res.json({
                    message:
                        `Inventory for ${name} updated.`
                });

            } else {

                await db
                    .collection('inventory')
                    .add({
                        name,
                        stock: parsedStock
                    });

                res.status(201).json({
                    message:
                        `New inventory item ${name} added.`
                });
            }

        } catch (err) {

            console.error(
                '[Inventory] Create/update error:',
                err
            );

            res.status(500).json({
                error: err.message
            });
        }
    }
);

// UPDATE STOCK
app.put(
    '/api/inventory/:id',
    checkFirebaseDb,
    async (req, res) => {

        const docId = req.params.id;

        const {
            stock
        } = req.body;

        const parsedStock =
            parseInt(stock);

        if (isNaN(parsedStock)) {

            return res.status(400).json({
                error:
                    'Valid stock quantity is required.'
            });
        }

        try {

            const docRef =
                db
                    .collection('inventory')
                    .doc(docId);

            await docRef.update({
                stock: parsedStock
            });

            res.json({
                message:
                    'Inventory stock updated successfully.'
            });

        } catch (err) {

            console.error(
                '[Inventory] Update error:',
                err
            );

            res.status(500).json({
                error: err.message
            });
        }
    }
);

// ============================================================
// ORDERS - MONGODB + FIREBASE INVENTORY
// ============================================================

// GET ORDERS
app.get('/api/orders', async (req, res) => {

    try {

        const orders =
            await Order.find({
                productName: {
                    $ne: null
                }
            }).lean();

        res.json({
            orders
        });

    } catch (err) {

        console.error(
            '[Orders] Load error:',
            err
        );

        res.status(500).json({
            error: err.message
        });
    }
});

// CREATE ORDER
app.post(
    '/api/orders',
    checkFirebaseDb,
    async (req, res) => {

        const {
            customer,
            productName,
            quantity
        } = req.body;

        const qty =
            parseInt(quantity);

        if (
            !customer ||
            !productName ||
            qty <= 0
        ) {

            return res.status(400).json({
                error:
                    'Missing customer, product, or invalid quantity.'
            });
        }

        try {

            // Find product in Firebase inventory
            const snapshot =
                await db
                    .collection('inventory')
                    .where('name', '==', productName)
                    .limit(1)
                    .get();

            if (snapshot.empty) {

                return res.status(404).json({
                    error:
                        `Product "${productName}" not found in inventory.`
                });
            }

            const itemDoc =
                snapshot.docs[0];

            const currentStock =
                itemDoc.data().stock;

            const itemId =
                itemDoc.id;

            if (currentStock < qty) {

                return res.status(400).json({
                    error:
                        `Insufficient stock for ${productName}. Available: ${currentStock}`
                });
            }

            // Decrease inventory
            const docRef =
                db
                    .collection('inventory')
                    .doc(itemId);

            await docRef.update({
                stock: currentStock - qty
            });

            // Create order
            const newOrder =
                new Order({

                    customerName: customer,

                    productName,

                    quantity: qty,

                    amount:
                        Math.floor(
                            Math.random() * 500
                        ) + 50,

                    status: 'Processing'
                });

            await newOrder.save();

            res.status(201).json({
                message:
                    'Order placed successfully and inventory updated.'
            });

        } catch (err) {

            console.error(
                '[Orders] Create error:',
                err
            );

            res.status(500).json({
                error:
                    err.message ||
                    'Failed to process order.'
            });
        }
    }
);

// UPDATE ORDER STATUS
app.put(
    '/api/orders/:id/status',
    async (req, res) => {

        const orderId =
            req.params.id;

        const {
            status
        } = req.body;

        if (
            !status ||
            ![
                'Processing',
                'Completed',
                'Cancelled'
            ].includes(status)
        ) {

            return res.status(400).json({
                error:
                    'Invalid or missing status provided.'
            });
        }

        try {

            const order =
                await Order.findById(orderId);

            if (!order) {

                return res.status(404).json({
                    error:
                        'Order not found.'
                });
            }

            const updatedOrder =
                await Order.findByIdAndUpdate(
                    orderId,
                    { status },
                    { new: true }
                );

            res.json({

                message:
                    `Order ${orderId} status updated to ${status}.`,

                order:
                    updatedOrder
            });

        } catch (err) {

            console.error(
                '[Orders] Status update error:',
                err
            );

            res.status(500).json({
                error: err.message
            });
        }
    }
);

// ============================================================
// REFERRAL BFS
// ============================================================

function findReferralTier(
    graph,
    startNode,
    targetNode
) {

    const start =
        startNode.toLowerCase();

    const target =
        targetNode.toLowerCase();

    if (start === target) {
        return 0;
    }

    const queue = [
        {
            node: start,
            tier: 0
        }
    ];

    const visited =
        new Set([start]);

    while (queue.length > 0) {

        const {
            node,
            tier
        } = queue.shift();

        if (graph[node]) {

            for (
                const neighbor
                of graph[node]
            ) {

                const lowerNeighbor =
                    neighbor.toLowerCase();

                if (
                    lowerNeighbor === target
                ) {

                    return tier + 1;
                }

                if (
                    !visited.has(
                        lowerNeighbor
                    )
                ) {

                    visited.add(
                        lowerNeighbor
                    );

                    queue.push({
                        node: lowerNeighbor,
                        tier: tier + 1
                    });
                }
            }
        }
    }

    return -1;
}

// REFERRAL DEPTH
app.get(
    '/api/referrals/depth/:name',
    (req, res) => {

        const targetName =
            req.params.name;

        const startNode =
            'CEO';

        const tier =
            findReferralTier(
                referralGraph,
                startNode,
                targetName
            );

        if (tier >= 0) {

            res.json({

                message:
                    `${targetName} is on Tier ${tier} of the referral network.`,

                customer:
                    targetName,

                tier,

                graph:
                    referralGraph
            });

        } else {

            res.status(404).json({

                error:
                    `${targetName} not found in the referral graph or is not reachable from ${startNode}.`,

                graph:
                    referralGraph
            });
        }
    }
);

// ============================================================
// VENDOR PERFORMANCE - LIS / DYNAMIC PROGRAMMING
// ============================================================

function calculateLIS(salesHistory) {

    if (
        !salesHistory ||
        salesHistory.length === 0
    ) {
        return 0;
    }

    const values =
        salesHistory.map(
            item => item.revenue
        );

    const n =
        values.length;

    const dp =
        Array(n).fill(1);

    let maxLIS = 0;

    for (
        let i = 0;
        i < n;
        i++
    ) {

        for (
            let j = 0;
            j < i;
            j++
        ) {

            if (
                values[i] >
                values[j]
            ) {

                dp[i] =
                    Math.max(
                        dp[i],
                        dp[j] + 1
                    );
            }
        }

        maxLIS =
            Math.max(
                maxLIS,
                dp[i]
            );
    }

    return maxLIS;
}

// VENDOR PERFORMANCE
app.get(
    '/api/vendor-performance',
    async (req, res) => {

        try {

            const monthlySales = [

                {
                    month: 'Jan',
                    revenue: 15000
                },

                {
                    month: 'Feb',
                    revenue: 12000
                },

                {
                    month: 'Mar',
                    revenue: 18000
                },

                {
                    month: 'Apr',
                    revenue: 25000
                },

                {
                    month: 'May',
                    revenue: 20000
                },

                {
                    month: 'Jun',
                    revenue: 30000
                }

            ];

            const totalRevenue =
                monthlySales.reduce(
                    (sum, item) =>
                        sum + item.revenue,
                    0
                );

            const trendScoreLIS =
                calculateLIS(
                    monthlySales
                );

            const overallVendorScore =
                Math.floor(
                    totalRevenue / 1000
                ) * trendScoreLIS;

            res.json({

                trendScoreLIS,

                totalRevenue,

                overallVendorScore,

                salesHistory:
                    monthlySales
            });

        } catch (err) {

            res.status(500).json({
                error: err.message
            });
        }
    }
);

// ============================================================
// RECENT SALES - SLIDING WINDOW
// ============================================================

app.get(
    '/api/metrics/recent-sales',
    async (req, res) => {

        try {

            const recentOrders =
                await Order.find()
                    .sort({
                        createdAt: -1
                    })
                    .limit(5)
                    .lean();

            const K = 3;

            const windowSize =
                Math.min(
                    K,
                    recentOrders.length
                );

            let recentRevenue = 0;
            let recentQuantity = 0;

            for (
                let i = 0;
                i < windowSize;
                i++
            ) {

                recentRevenue +=
                    recentOrders[i].amount || 0;

                recentQuantity +=
                    recentOrders[i].quantity || 0;
            }

            res.json({

                windowSize,

                averageRevenuePerWindow:
                    windowSize > 0
                        ? (
                            recentRevenue /
                            windowSize
                        ).toFixed(2)
                        : 0,

                totalRevenueInWindow:
                    recentRevenue.toFixed(2),

                totalQuantityInWindow:
                    recentQuantity,

                recentOrders:
                    recentOrders.slice(
                        0,
                        windowSize
                    )
            });

        } catch (err) {

            console.error(
                '[Metrics] Recent sales error:',
                err
            );

            res.status(500).json({
                error:
                    'Failed to calculate recent sales metrics.'
            });
        }
    }
);

// ============================================================
// RFM ANALYSIS
// ============================================================

app.get(
    '/api/rfm',
    async (req, res) => {

        const today =
            new Date();

        try {

            const rfmData =
                await Order.aggregate([

                    {
                        $group: {

                            _id:
                                '$customerName',

                            lastOrderDate:
                                {
                                    $max:
                                        '$createdAt'
                                },

                            frequency:
                                {
                                    $sum: 1
                                },

                            monetary:
                                {
                                    $sum:
                                        '$amount'
                                }
                        }
                    },

                    {
                        $project: {

                            _id: 0,

                            customer:
                                '$_id',

                            Recency: {

                                $divide: [

                                    {
                                        $subtract: [
                                            today,
                                            '$lastOrderDate'
                                        ]
                                    },

                                    1000 *
                                    60 *
                                    60 *
                                    24
                                ]
                            },

                            Frequency:
                                '$frequency',

                            Monetary:
                                '$monetary'
                        }
                    },

                    {
                        $sort: {
                            Recency: 1
                        }
                    }
                ]);

            const cleanedRfmData =
                rfmData.map(d => ({

                    customer:
                        d.customer,

                    Recency:
                        Math.round(
                            d.Recency
                        ),

                    Frequency:
                        d.Frequency,

                    Monetary:
                        Math.round(
                            d.Monetary
                        )
                }));

            res.json(
                cleanedRfmData
            );

        } catch (err) {

            console.error(
                '[RFM] Calculation error:',
                err
            );

            res.status(500).json({
                error:
                    'Failed to calculate RFM metrics. Check MongoDB connection.'
            });
        }
    }
);

// ============================================================
// CLV ANALYSIS
// ============================================================

app.get(
    '/api/clv',
    async (req, res) => {

        try {

            // Calculate AOV and total customers
            const aggregateResults =
                await Order.aggregate([

                    {
                        $group: {

                            _id: null,

                            totalRevenue:
                                {
                                    $sum:
                                        '$amount'
                                },

                            totalOrders:
                                {
                                    $sum: 1
                                },

                            totalCustomers:
                                {
                                    $addToSet:
                                        '$customerName'
                                }
                        }
                    },

                    {
                        $project: {

                            _id: 0,

                            AOV:
                                {
                                    $divide: [
                                        '$totalRevenue',
                                        '$totalOrders'
                                    ]
                                },

                            TotalCustomers:
                                {
                                    $size:
                                        '$totalCustomers'
                                }
                        }
                    }
                ]);

            const AOV =
                aggregateResults.length > 0 &&
                aggregateResults[0].AOV
                    ? aggregateResults[0].AOV
                    : 1;

            const TotalCustomers =
                aggregateResults.length > 0
                    ? aggregateResults[0].TotalCustomers
                    : 1;

            // Purchase frequency
            const TotalOrders =
                await Order.countDocuments();

            const PF =
                TotalCustomers > 0
                    ? TotalOrders /
                      TotalCustomers
                    : 0;

            // Customer monetary value
            const customerMonetary =
                await Order.aggregate([

                    {
                        $group: {

                            _id:
                                '$customerName',

                            monetary:
                                {
                                    $sum:
                                        '$amount'
                                }
                        }
                    }
                ]);

            const LifetimeYears = 3;

            const clvData =
                customerMonetary.map(d => ({

                    customer:
                        d._id,

                    value:
                        Math.round(
                            (
                                (
                                    d.monetary /
                                    AOV
                                ) *
                                PF *
                                LifetimeYears
                            ) * 100
                        ) / 100
                }));

            res.json(
                clvData.sort(
                    (a, b) =>
                        b.value -
                        a.value
                )
            );

        } catch (err) {

            console.error(
                '[CLV] Calculation error:',
                err
            );

            res.status(500).json({
                error:
                    'Failed to calculate CLV metrics. Check MongoDB connection.'
            });
        }
    }
);

// ============================================================
// NPS - FIREBASE
// ============================================================

// SUBMIT FEEDBACK
app.post(
    '/api/feedback',
    checkFirebaseDb,
    async (req, res) => {

        const {
            score,
            comment,
            customerId
        } = req.body;

        const numericScore =
            parseInt(score);

        if (
            isNaN(numericScore) ||
            numericScore < 0 ||
            numericScore > 10
        ) {

            return res.status(400).json({
                error:
                    'Score must be a number between 0 and 10.'
            });
        }

        try {

            const newFeedback = {

                score:
                    numericScore,

                comment:
                    comment || '',

                customerId:
                    customerId || 'anonymous',

                createdAt:
                    admin.firestore.FieldValue
                        .serverTimestamp()
            };

            const docRef =
                await db
                    .collection('feedback')
                    .add(newFeedback);

            res.status(201).json({

                message:
                    'Feedback submitted successfully',

                id:
                    docRef.id
            });

        } catch (err) {

            console.error(
                '[NPS] Feedback submission error:',
                err
            );

            res.status(500).json({
                error:
                    'Failed to submit feedback to Firebase.'
            });
        }
    }
);

// GET NPS
app.get(
    '/api/nps',
    checkFirebaseDb,
    async (req, res) => {

        try {

            const snapshot =
                await db
                    .collection('feedback')
                    .get();

            const scores =
                snapshot.docs.map(
                    doc =>
                        doc.data().score
                );

            if (scores.length === 0) {

                return res.json({

                    promoters: 0,

                    passives: 0,

                    detractors: 0,

                    total: 0,

                    npsScore: 0,

                    message:
                        'No feedback data available.'
                });
            }

            let promoters = 0;
            let passives = 0;
            let detractors = 0;

            const total =
                scores.length;

            scores.forEach(score => {

                if (score >= 9) {

                    promoters++;

                } else if (score >= 7) {

                    passives++;

                } else {

                    detractors++;
                }
            });

            const npsScore =
                Math.round(
                    (
                        (
                            promoters -
                            detractors
                        ) / total
                    ) * 100
                );

            res.json({

                promoters,

                passives,

                detractors,

                total,

                npsScore
            });

        } catch (err) {

            console.error(
                '[NPS] Calculation error:',
                err
            );

            res.status(500).json({
                error:
                    'Failed to calculate NPS metrics. Check Firebase permissions.'
            });
        }
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {

    res.json({
        status: 'ok',
        message: 'Vendor Analytics Platform is running',
        mongoConfigured: Boolean(MONGO_URI),
        firebaseConfigured: Boolean(db),
        timestamp: new Date().toISOString()
    });

});

// ============================================================
// 404 HANDLER FOR API ROUTES
// ============================================================

app.use('/api', (req, res) => {

    res.status(404).json({
        error: 'API endpoint not found.'
    });

});

// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            'Frontend available at /'
        );

        console.log(
            'API endpoints available under /api/'
        );

    }
);
