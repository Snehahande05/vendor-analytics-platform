**Project Title** :- Develop a vendor performance analytics platform using Mongodb firebase with dynamic programming for score calculation using any data structure 

**scenario/theme** :- Customer Acquisition to Loyalty: Sales Funnel & Operations Dashboard
You will design and implement a complete system that captures leads, qualifies them,
converts them into customers, and provides business insights through a real-time
dashboard. The goal is to demonstrate practical skills in algorithms, database design,
and business process analysis.

The **Vendor Performance Analytics Platform** is a web-based system designed to evaluate, visualize, and optimize vendor performance using **RFM (Recency, Frequency, Monetary)** analysis, **CLV (Customer Lifetime Value)**, and **NPS (Net Promoter Score)** metrics.  

It helps businesses track vendor engagement, loyalty, and profitability through intelligent scoring and real-time dashboards powered by **MongoDB**, **Firebase**, and **Dynamic Programming** concepts.

**Setup Instruction**
Detailed Setup Instructions (what you used)
1. Frontend: Plain HTML + CSS + JavaScript
   - To run locally: open frontend/index.html in a browser or serve via a local static server.

2. Backend: JavaScript scripts and optional Node server
   - If you use the server.js (Node + Express):
     • Install Node.js (v14+ recommended).
     • From backend/: run `npm install` to install dependencies.
     • Configure .env (if present) and place serviceAccount.json securely (do NOT commit to GitHub).
    
   - If you prefer plain JS only (no Node):
     • Move scoring scripts to run in the browser or as static worker scripts.
     • Use frontend to load orders_import_data.json via fetch and compute RFM/CLV client-side.

3. Firebase: Requires a Firebase service account file (`serviceAccount.json`) and enabling Firestore/Cloud Messaging for push notifications.

**features**
State the Features implemented in the project:
1. Customer Acquisition to Loyalty (Business + DSA)

Lead Capture Form: Collects vendor details like name, email, phone, performance data, and stores them securely in MongoDB.

Lead Qualification Logic: Vendors are scored dynamically using priority-based data structures to rank them by performance metrics (like on-time delivery, quality, responsiveness).

Customer Lifecycle Flow: Tracks each vendor’s journey — from registration to performance evaluation to loyalty (top-rated vendors).

2. Sales Funnel & CRM (Business + DSA)

Funnel Visualization: The platform tracks vendors through stages — New → Active → Verified → Trusted → Flagged (if low performance).

Duplicate Detection: Uses hash-based lookup to avoid duplicate vendor entries during registration or analytics updates.

3. Business Metrics Dashboard (Business + NoSQL)

Real-time Dashboard: Displays vendor analytics such as total vendors, active vendors, performance rating distribution, and category-wise insights.

MongoDB Aggregations: Used to calculate advanced metrics such as:

RFM Segmentation (Recency, Frequency, Monetary) – to identify top-performing vendors.

Customer Lifetime Value (CLV) – evaluates the long-term value of a vendor based on consistent performance.

Net Promoter Score (NPS) – measures satisfaction and loyalty from collected feedback.

Firebase Sync: Enables near real-time updates and performance scoring without refreshing the page.

4. Operations Module (Business + DSA)

Vendor Performance Tracking: Maintains record of vendor operations, response rates, and delivery history.

5. Algorithms & Data Structures Focus (Core DSA Integration)

The project integrates DSA concepts for backend logic and analytics optimization:

Priority Queue / Heap: Used for ranking and scoring vendors dynamically.

Hash Tables: Used for quick vendor lookup and duplicate detection.

Sliding Window / Dynamic Programming: Calculates time-based performance averages for recent vendor activities.

Graph / BFS: Designed to map vendor relationships or referrals (optional extension module).

**API Endpoints** (from server.js)
Method	      Endpoint	                     Description
GET	          /api/leads	                 Get all leads
POST	      /api/leads	                 Add a new lead
POST	      /api/leads/qualify/:id	     Qualify a lead
POST	      /api/leads/disqualify/:id	     Disqualify a lead
GET	          /api/rfm	                     RFM metric results
GET	          /api/clv	                     CLV metric results
GET	          /api/nps	                     NPS results
POST	      /api/feedback	                 Submit feedback
GET	          /api/vendor-performance	     Overall vendor analytics
