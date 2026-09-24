# 🏆 ابطال الرياضة الإبراهيمية (Sports Champions Alexandria)
### Complete Production-Ready Full-Stack Retail Platform (E-Commerce + Multi-Branch POS + ERP)

A full-stack retail management platform for **"ابطال الرياضة الإبراهيمية" (Sports Champions)** based in Alexandria, Egypt.

---

## 📍 Flagship Branch Information
- **Location:** 92 Omar Lotfy St, Al Ibrahimeyah Bahri, Sidi Gaber, Bab Sharqi, Alexandria
- **Phone:** 03 5926908
- **Working Hours:** Sat–Wed 10am–10pm | Thu–Fri 10am–11pm

---

## 🛠️ Core Technology Stack
- **Framework:** Next.js 15+ (App Router), React 19, TypeScript Strict
- **Styling:** Tailwind CSS v4, Lucide Icons, Custom Design Tokens with Cairo & Tajawal Arabic typography, full RTL-first UI design
- **Database:** Prisma ORM connected to Neon PostgreSQL
- **Internationalization:** `next-intl` (full AR/EN bilingual dictionaries for storefront, admin ERP, touch POS, receipts)
- **Auth:** NextAuth.js for staff roles & guest phone-first identity for storefront customers
- **State Management:** Zustand (Cart & POS cashier state with IndexedDB offline queue support)
- **Deployment:** Vercel

---

## 🚀 Quick Setup & Local Development

### 1. Prerequisites
- Node.js v22.12+
- NPM v10+

### 2. Environment Setup
Copy `.env.example` to `.env` and adjust credentials if needed:
```bash
cp .env.example .env
```

Provide the Neon connection values locally through environment variables; never commit real credentials:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

> If a credential was ever committed or shared, rotate it immediately in the provider dashboard and replace it in the deployment secret store.

### 3. Database Push & Seeding
Push the schema to Neon database and seed real catalog data (swim caps, TRX bands, Crocs, treadmills, ballet shoes, etc.) alongside staff accounts:
```bash
npx prisma db push
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🔐 Staff Login Credentials

Staff accounts are created by the seed script or by a `SUPER_ADMIN` in the Admin UI. Passwords are never stored in this repository. For local development, set/reset a password through your environment-specific seed process and share it through a password manager.

---

## 📖 Runbooks

### 🏢 Runbook 1: How to Onboard a New Branch
When expanding from 1 branch to 2-4 branches:
1. Open **ERP Admin Dashboard** -> **Settings** -> **Branches**.
2. Click **Add New Branch**. Enter Branch Name (Arabic/English), Address, City (e.g. Alexandria/Cairo), Phone, and Working Hours.
3. Save the branch.
4. Go to **Inventory** section. Select the new branch to populate initial stock, or perform a **Stock Transfer** from the Flagship branch (*Al Ibrahimeyah*).
5. Assign staff users or cashiers to the new branch ID via **Roles & Staff Settings**.

### 📜 Runbook 2: How to Enable ETA E-Invoicing & E-Receipts
1. Ensure the business is VAT registered with an official 9-digit Tax Registration Number (e.g., `123-456-789`).
2. Update `.env` variables:
   ```env
   ETA_ENABLED="true"
   ETA_TAX_REGISTRATION_NUMBER="YOUR_OFFICIAL_TAX_NUMBER"
   ETA_CLIENT_ID="YOUR_ETA_API_CLIENT_ID"
   ETA_CLIENT_SECRET="YOUR_ETA_API_CLIENT_SECRET"
   ```
3. Restart the server or deploy to Vercel.
4. Every POS sale ticket and online order will submit B2C e-receipt payloads directly to the Egyptian Tax Authority (ETA) gateway while rendering a compliant ETA verification QR Code on printable physical/digital receipts.

---

## ☁️ Vercel Deployment Instructions
1. Push repository code to GitHub/GitLab.
2. Import repository into Vercel.
3. Add Environment Variables in Vercel settings (copy all key-value pairs from `.env`).
4. Set Build Command: `npm run build`.
5. Deploy! Next.js 15 App Router dynamic API routes and static pages will be deployed instantly.
