# Firestore Guide for Hawkr

## Table of Contents
1. [What is Firestore?](#what-is-firestore)
2. [Key Concepts](#key-concepts)
3. [Collection Structure](#collection-structure)
4. [Setting Up Firebase](#setting-up-firebase)
5. [Basic Operations (CRUD)](#basic-operations-crud)
6. [Querying Data](#querying-data)
7. [Real-time Listeners](#real-time-listeners)
8. [Security Rules](#security-rules)
9. [Best Practices](#best-practices)

---

## What is Firestore?

Firestore is a **NoSQL document database** from Firebase/Google. Unlike SQL databases (MySQL, PostgreSQL), it:

- Stores data as **documents** (like JSON objects) inside **collections** (like folders)
- Has no tables, rows, or columns - just nested documents
- Scales automatically
- Supports real-time updates (data syncs instantly across all clients)
- Works offline (caches data locally)

### SQL vs Firestore Terminology

| SQL | Firestore |
|-----|-----------|
| Database | Project |
| Table | Collection |
| Row | Document |
| Column | Field |
| Primary Key | Document ID |
| Foreign Key | Document Reference / ID string |

---

## Key Concepts

### 1. Collections
A collection is a container for documents. Think of it as a folder.

```
/customers          <- Collection
/foodStalls         <- Collection
/orders             <- Collection
```

### 2. Documents
A document is a single record containing fields (key-value pairs). Each document has a unique ID.

```
/customers/abc123   <- Document with ID "abc123"
{
  name: "John Doe",
  email: "john@example.com",
  createdAt: Timestamp
}
```

### 3. Subcollections
Documents can contain their own collections (subcollections). This is useful for nested data.

```
/customers/abc123/paymentMethods/pm001   <- Subcollection document
{
  type: "Visa",
  lastFour: "4242"
}
```

### 4. Document References
Instead of foreign keys, you store the document ID or a reference to another document.

```javascript
// Storing a reference (as string ID)
{
  stallId: "stall_abc123"  // ID of the FoodStall document
}

// Or as a DocumentReference
{
  stallRef: doc(db, "foodStalls", "stall_abc123")
}
```

---

## Collection Structure

Here's the Firestore structure for Hawkr:

```
firestore/
├── customers/                    # Customer profiles
│   └── {customerId}/            # Document ID = Firebase Auth UID
│       ├── name: string
│       ├── email: string
│       ├── phone: string
│       ├── nric: string
│       ├── profilePhoto: string (URL)
│       ├── telegramConnected: boolean
│       ├── browserNotifications: boolean
│       ├── createdAt: timestamp
│       ├── updatedAt: timestamp
│       │
│       ├── paymentMethods/      # Subcollection
│       │   └── {paymentMethodId}/
│       │       ├── type: string
│       │       ├── lastFour: string
│       │       ├── expiry: string
│       │       ├── isDefault: boolean
│       │       └── createdAt: timestamp
│       │
│       ├── cart/                # Subcollection (one cart per stall)
│       │   └── {stallId}/
│       │       ├── stallId: string
│       │       ├── stallName: string (denormalized)
│       │       ├── updatedAt: timestamp
│       │       │
│       │       └── items/       # Sub-subcollection
│       │           └── {itemId}/
│       │               ├── itemCode: string
│       │               ├── itemName: string
│       │               ├── quantity: number
│       │               ├── unitPrice: number
│       │               ├── specialRequests: string
│       │               └── addedAt: timestamp
│       │
│       └── notifications/       # Subcollection
│           └── {notificationId}/
│               ├── type: string
│               ├── title: string
│               ├── message: string
│               ├── isRead: boolean
│               ├── relatedType: string
│               ├── relatedId: string
│               └── createdAt: timestamp
│
├── stallOwners/                 # Stall owner profiles
│   └── {ownerId}/              # Document ID = Firebase Auth UID
│       ├── name: string
│       ├── email: string
│       ├── phone: string
│       ├── nric: string
│       ├── profilePhoto: string
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── operators/                   # Hawker centre operators
│   └── {operatorId}/           # Document ID = Firebase Auth UID
│       ├── name: string
│       ├── contactPerson: string
│       ├── email: string
│       ├── phone: string
│       └── createdAt: timestamp
│
├── hawkerCentres/
│   └── {hawkerCentreId}/
│       ├── name: string
│       ├── address: string
│       ├── postalCode: string
│       ├── image: string (URL)
│       ├── rating: number (computed)
│       ├── totalStalls: number (computed)
│       ├── operatingHours: map { mon: {open, close}, tue: {...}, ... }
│       ├── latitude: number
│       ├── longitude: number
│       ├── operatorId: string
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── foodStalls/
│   └── {stallId}/
│       ├── name: string
│       ├── unitNo: string
│       ├── description: string
│       ├── image: string (URL)
│       ├── rating: number (computed average)
│       ├── totalReviews: number (computed count)
│       ├── operatingHours: map
│       ├── isOpen: boolean
│       ├── hygieneGrade: string (A/B/C/D)
│       ├── gradeExpiry: timestamp
│       ├── cuisines: array [string] (cuisine IDs)
│       ├── hawkerCentreId: string
│       ├── ownerId: string
│       ├── createdAt: timestamp
│       ├── updatedAt: timestamp
│       │
│       └── menuItems/           # Subcollection
│           └── {itemCode}/
│               ├── name: string
│               ├── description: string
│               ├── price: number
│               ├── category: string
│               ├── image: string (URL)
│               ├── isAvailable: boolean
│               ├── isHalal: boolean
│               ├── prepTime: number (minutes)
│               ├── cuisines: array [string]
│               ├── createdAt: timestamp
│               └── updatedAt: timestamp
│
├── cuisines/
│   └── {cuisineId}/
│       ├── name: string
│       ├── description: string
│       └── icon: string (URL)
│
├── orders/
│   └── {orderId}/
│       ├── customerId: string
│       ├── customerName: string (denormalized)
│       ├── stallId: string
│       ├── stallName: string (denormalized)
│       ├── hawkerCentreId: string
│       ├── items: array [
│       │     {
│       │       itemCode: string,
│       │       itemName: string,
│       │       quantity: number,
│       │       unitPrice: number,
│       │       subtotal: number,
│       │       specialRequests: string
│       │     }
│       │   ]
│       ├── totalAmount: number
│       ├── status: string (pending/confirmed/preparing/ready/completed/cancelled)
│       ├── paymentType: string
│       ├── paymentStatus: string (pending/paid/refunded)
│       ├── specialInstructions: string
│       ├── estimatedReadyTime: timestamp
│       ├── completedAt: timestamp
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── feedback/
│   └── {feedbackId}/
│       ├── customerId: string
│       ├── customerName: string (denormalized)
│       ├── orderId: string (optional)
│       ├── stallId: string
│       ├── stallName: string (denormalized)
│       ├── rating: number (1-5)
│       ├── comment: string
│       ├── tags: array [string] (e.g., ["Fast service", "Good value"])
│       ├── contactRequested: boolean
│       ├── contactEmail: string
│       ├── contactPhone: string
│       ├── isPublic: boolean
│       ├── stallResponse: string
│       ├── stallResponseDate: timestamp
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── complaints/
│   └── {complaintId}/
│       ├── customerId: string
│       ├── customerName: string
│       ├── stallId: string
│       ├── stallName: string
│       ├── feedbackId: string (optional)
│       ├── category: string
│       ├── description: string
│       ├── status: string (open/investigating/resolved/closed)
│       ├── resolution: string
│       ├── resolvedBy: string
│       ├── resolvedAt: timestamp
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── inspections/
│   └── {inspectionId}/
│       ├── stallId: string
│       ├── stallName: string
│       ├── officerId: string
│       ├── officerName: string
│       ├── inspectionDate: timestamp
│       ├── remarks: string
│       ├── hygieneGrade: string
│       ├── gradeExpiry: timestamp
│       ├── violationsFound: string
│       ├── followUpRequired: boolean
│       ├── followUpDate: timestamp
│       └── createdAt: timestamp
│
├── neaOfficers/
│   └── {officerId}/
│       ├── name: string
│       ├── phone: string
│       ├── email: string
│       ├── badgeNo: string
│       └── isActive: boolean
│
├── promotions/
│   └── {promoId}/
│       ├── stallId: string
│       ├── stallName: string
│       ├── title: string
│       ├── description: string
│       ├── image: string (URL)
│       ├── startDate: timestamp
│       ├── endDate: timestamp
│       ├── discountType: string (percentage/fixed)
│       ├── discountValue: number
│       ├── minOrderAmount: number
│       ├── promoCode: string
│       ├── usageLimit: number
│       ├── usageCount: number
│       ├── isActive: boolean
│       └── createdAt: timestamp
│
└── rentalAgreements/
    └── {agreementId}/
        ├── stallId: string
        ├── ownerId: string
        ├── ownerName: string
        ├── startDate: timestamp
        ├── endDate: timestamp
        ├── termsAndConditions: string
        ├── rentalPrice: number
        ├── status: string (active/expired/terminated)
        └── createdAt: timestamp
```

---

## Setting Up Firebase

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: "hawkr" (or your preferred name)
4. Enable/disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Firestore

1. In Firebase Console, go to "Build" > "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Select a location closest to Singapore (asia-southeast1)

### Step 3: Enable Authentication

1. Go to "Build" > "Authentication"
2. Click "Get started"
3. Enable sign-in methods:
   - Email/Password
   - Google (optional)
   - Phone (optional for OTP)

### Step 4: Get Firebase Config

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" > Click web icon (</>)
3. Register app with nickname "hawkr-web"
4. Copy the firebaseConfig object

---

## Basic Operations (CRUD)

### Initialize Firebase (see firebase/config.js)

```javascript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Your config here
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### CREATE - Adding Documents

```javascript
import { collection, addDoc, doc, setDoc } from "firebase/firestore";

// Method 1: Auto-generated ID (recommended for most cases)
const feedbackRef = await addDoc(collection(db, "feedback"), {
  customerId: "user123",
  stallId: "stall456",
  rating: 4,
  comment: "Great food!",
  createdAt: new Date()
});
console.log("Document ID:", feedbackRef.id);

// Method 2: Custom ID (useful when ID is known, like Auth UID)
await setDoc(doc(db, "customers", "user123"), {
  name: "John Doe",
  email: "john@example.com",
  createdAt: new Date()
});
```

### READ - Getting Documents

```javascript
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

// Get a single document by ID
const customerDoc = await getDoc(doc(db, "customers", "user123"));
if (customerDoc.exists()) {
  console.log("Customer data:", customerDoc.data());
} else {
  console.log("No such customer!");
}

// Get all documents in a collection
const stallsSnapshot = await getDocs(collection(db, "foodStalls"));
stallsSnapshot.forEach((doc) => {
  console.log(doc.id, " => ", doc.data());
});
```

### UPDATE - Modifying Documents

```javascript
import { doc, updateDoc, setDoc } from "firebase/firestore";

// Update specific fields (document must exist)
await updateDoc(doc(db, "customers", "user123"), {
  name: "John Smith",
  updatedAt: new Date()
});

// Set with merge (creates if doesn't exist, updates if does)
await setDoc(doc(db, "customers", "user123"), {
  phone: "+65 9123 4567"
}, { merge: true });
```

### DELETE - Removing Documents

```javascript
import { doc, deleteDoc } from "firebase/firestore";

// Delete a document
await deleteDoc(doc(db, "feedback", "feedback123"));
```

---

## Querying Data

```javascript
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// Simple query - get all feedback for a stall
const q = query(
  collection(db, "feedback"),
  where("stallId", "==", "stall456")
);

// Multiple conditions
const q2 = query(
  collection(db, "feedback"),
  where("stallId", "==", "stall456"),
  where("rating", ">=", 4),
  orderBy("rating", "desc"),
  orderBy("createdAt", "desc"),
  limit(10)
);

// Execute query
const querySnapshot = await getDocs(q2);
querySnapshot.forEach((doc) => {
  console.log(doc.id, " => ", doc.data());
});

// Common query operators:
// ==    equals
// !=    not equals
// <     less than
// <=    less than or equal
// >     greater than
// >=    greater than or equal
// in    value in array
// not-in value not in array
// array-contains       array field contains value
// array-contains-any   array field contains any of values
```

### Important Query Limitations

1. **Compound queries** with range filters on different fields require a composite index
2. **No OR queries** - use `in` operator or make multiple queries
3. **No != with orderBy** on different fields
4. **Array queries** - `array-contains` can only be used once per query

---

## Real-time Listeners

Firestore can push updates to your app in real-time!

```javascript
import { doc, collection, onSnapshot, query, where } from "firebase/firestore";

// Listen to a single document
const unsubscribe = onSnapshot(doc(db, "orders", "order123"), (doc) => {
  console.log("Order updated:", doc.data());
  // Update your UI here
});

// Listen to a collection/query
const q = query(
  collection(db, "orders"),
  where("customerId", "==", "user123"),
  where("status", "in", ["pending", "confirmed", "preparing"])
);

const unsubscribeOrders = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      console.log("New order:", change.doc.data());
    }
    if (change.type === "modified") {
      console.log("Updated order:", change.doc.data());
    }
    if (change.type === "removed") {
      console.log("Removed order:", change.doc.data());
    }
  });
});

// IMPORTANT: Unsubscribe when component unmounts to avoid memory leaks
// Call unsubscribe() when done
```

---

## Security Rules

Security rules control who can read/write data. Go to Firestore > Rules.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the document
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Customers - users can only read/write their own data
    match /customers/{customerId} {
      allow read, write: if isOwner(customerId);
      
      // Subcollections
      match /paymentMethods/{methodId} {
        allow read, write: if isOwner(customerId);
      }
      match /cart/{cartId} {
        allow read, write: if isOwner(customerId);
        match /items/{itemId} {
          allow read, write: if isOwner(customerId);
        }
      }
      match /notifications/{notifId} {
        allow read, write: if isOwner(customerId);
      }
    }
    
    // Food Stalls - anyone can read, only owner can write
    match /foodStalls/{stallId} {
      allow read: if true;
      allow write: if isAuthenticated() && 
        get(/databases/$(database)/documents/foodStalls/$(stallId)).data.ownerId == request.auth.uid;
      
      match /menuItems/{itemId} {
        allow read: if true;
        allow write: if isAuthenticated();
      }
    }
    
    // Hawker Centres - anyone can read
    match /hawkerCentres/{centreId} {
      allow read: if true;
      allow write: if isAuthenticated(); // TODO: restrict to operators
    }
    
    // Cuisines - anyone can read
    match /cuisines/{cuisineId} {
      allow read: if true;
      allow write: if false; // Admin only via Firebase Admin SDK
    }
    
    // Orders - customer can read their own, stall owner can read stall orders
    match /orders/{orderId} {
      allow read: if isAuthenticated() && 
        (resource.data.customerId == request.auth.uid || 
         resource.data.ownerId == request.auth.uid);
      allow create: if isAuthenticated() && 
        request.resource.data.customerId == request.auth.uid;
      allow update: if isAuthenticated();
    }
    
    // Feedback - anyone can read public, customer can write their own
    match /feedback/{feedbackId} {
      allow read: if resource.data.isPublic == true || 
        (isAuthenticated() && resource.data.customerId == request.auth.uid);
      allow create: if isAuthenticated() && 
        request.resource.data.customerId == request.auth.uid;
      allow update: if isAuthenticated() && 
        resource.data.customerId == request.auth.uid;
    }
    
    // Promotions - anyone can read active promotions
    match /promotions/{promoId} {
      allow read: if resource.data.isActive == true;
      allow write: if isAuthenticated(); // TODO: restrict to stall owners
    }
  }
}
```

---

## Best Practices

### 1. Denormalize Data
Store copies of frequently-read data to avoid extra queries.

```javascript
// Instead of just storing stallId, also store stallName
{
  stallId: "stall123",
  stallName: "Ah Heng Curry Chicken"  // Denormalized
}
```

### 2. Use Batch Writes for Multiple Operations
```javascript
import { writeBatch, doc } from "firebase/firestore";

const batch = writeBatch(db);

batch.set(doc(db, "orders", "order123"), orderData);
batch.update(doc(db, "foodStalls", "stall456"), { totalOrders: increment(1) });
batch.delete(doc(db, "customers/user123/cart", "stall456"));

await batch.commit();  // All succeed or all fail
```

### 3. Use Transactions for Read-then-Write
```javascript
import { runTransaction, doc } from "firebase/firestore";

await runTransaction(db, async (transaction) => {
  const stallDoc = await transaction.get(doc(db, "foodStalls", "stall123"));
  const newRating = calculateNewRating(stallDoc.data().rating, newFeedbackRating);
  
  transaction.update(doc(db, "foodStalls", "stall123"), {
    rating: newRating,
    totalReviews: stallDoc.data().totalReviews + 1
  });
});
```

### 4. Index Frequently Queried Fields
Firestore auto-creates single-field indexes, but compound queries need manual indexes.

Go to Firestore > Indexes > Add Index

### 5. Structure Data for Your Queries
Think about how you'll query data, then structure accordingly.

- If you always query orders by customer, put customerId at top level
- If you need all menu items for a stall, use subcollection under stall
- If you need all menu items across all stalls, use top-level collection with stallId field

---

## Next Steps

1. Set up Firebase project and get config
2. Create `firebase/config.js` with your credentials
3. Use `firebase/services/` files to interact with Firestore
4. Start with authentication, then feedback submission

See the code files in `/firebase/` folder for implementation examples.
