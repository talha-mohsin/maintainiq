# MaintainIQ Production Deployment Guide

This guide outlines step-by-step instructions for deploying MaintainIQ to production. MaintainIQ can be deployed in two architectures:

1. **Decoupled Architecture (Recommended)**: Frontend hosted on **Vercel** (high-performance CDN) and the Backend API hosted on **Render** (Node.js/Express) connected to MongoDB Atlas and Redis Cloud.
2. **Unified Architecture**: A single container hosting both the built React frontend and Express server on **Render**, **Railway**, or **Google Cloud Run** using the root `Dockerfile`.

---

## Production Credentials Checklist

Ensure you have gathered the following production-grade services:
* **MongoDB Atlas**: A hosted cluster URL (`mongodb+srv://...`).
* **Cloudinary**: Cloud image storage credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
* **Google Gemini API**: A secure server-side API Key (`GEMINI_API_KEY`) to power the triage and diagnostic engines.
* **Redis**: A Redis URL connection string (`redis://...`) for API caching of assets and dashboards.
* **SMTP Server / Google App Password**: Credentials (`MAIL_USER`, `MAIL_PASS`) to dispatch critical compliance emails.

---

## Option A: Decoupled Deployment (Vercel Frontend + Render Backend)

### 1. Backend API on Render

Render is ideal for hosting the Express backend.

#### Step-by-Step Configuration:
1. Sign in to [Render](https://render.com) and click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service settings:
   * **Name**: `maintainiq-api`
   * **Environment**: `Node`
   * **Root Directory**: `backend` (or leave empty if deploying as a monorepo with custom start)
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `node server.js`
4. Expand **Advanced** and add the following **Environment Variables**:
   * `NODE_ENV`: `production`
   * `PORT`: `3000`
   * `MONGODB_URI`: *Your MongoDB Atlas URL*
   * `REDIS_URL`: *Your Redis Connection String* (Render provides a managed Redis service or use Upstash/RedisCloud)
   * `GEMINI_API_KEY`: *Your Google Gen AI API Key*
   * `SECRET_KEY`: *A long cryptographically secure random string*
   * `CLOUDINARY_CLOUD_NAME`: *Your Cloudinary cloud name*
   * `CLOUDINARY_API_KEY`: *Your Cloudinary API key*
   * `CLOUDINARY_API_SECRET`: *Your Cloudinary API secret*
   * `MAIL_USER`: *Your sender email address*
   * `MAIL_PASS`: *Your SMTP server application password*
5. Click **Create Web Service**. Render will build and deploy the backend. Copy your service URL (e.g., `https://maintainiq-api.onrender.com`).

---

### 2. Frontend SPA on Vercel

Vercel is the premier host for static Vite-based Single Page Applications.

#### Step-by-Step Configuration:
1. Sign in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Configure the project:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Expand **Environment Variables** and add the following keys:
   * `VITE_API_URL`: `https://maintainiq-api.onrender.com/api` (Point this to your Render service URL from above, appending `/api`)
5. Click **Deploy**. Vercel will build and provision your edge application.

#### Crucial Production CORS & Cookie Sync:
Because the frontend (`vercel.app`) and backend (`onrender.com`) exist on different domains:
* Ensure cookies are sent securely. The server sets tokens via secure HTTPOnly cookies.
* If deploying on mismatched root domains, ensure your backend allows CORS credentials.
* Alternatively, map both to subdomains of a single root domain (e.g. `app.yourdomain.com` and `api.yourdomain.com`) to allow cookie sharing seamlessly.

---

## Option B: Unified Deployment (Single Container)

Unified deployment builds the frontend inside the backend, resolving CORS and cookie matching instantly.

1. Sign in to [Render](https://render.com) and click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   * **Name**: `maintainiq-fullstack`
   * **Environment**: `Docker`
   * **Docker Command**: (Leave default; Docker engine automatically picks up the root `Dockerfile`)
4. Add all environment variables listed in the Backend section to **Render Environment Variables**.
5. Click **Deploy**. Docker will run the multi-stage build:
   * Node compiles the Vite client in Stage 1.
   * Stage 2 compiles and launches the Node/Express server on port `3000`, serving the build statically while managing API routing cleanly.

---

## Production Security & Validation Check

MaintainIQ has standard fail-safe assertions built-in:
1. **MongoDB Atlas Safeguard**: In `production` mode, the server will **refuse to start** and throw an error if the environment variable `MONGODB_URI` is missing or fails to authenticate, protecting against silent sandbox data leakage.
2. **Cloudinary Asset Safety**: The server will immediately crash if an image upload is triggered in `production` and Cloudinary credentials are not present, ensuring that compliance evidence is never lost.
3. **Fail-Safe Caching**: Caching will automatically and gracefully fall back to local server-side memory if the Redis cluster undergoes failover, ensuring 100% continuous uptime.
