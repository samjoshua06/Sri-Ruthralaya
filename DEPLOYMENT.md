# Sri Ruthralaya Bharathanatyam Academy - Deployment Guide

This guide gives you exact, step-by-step instructions for deploying:
- **Backend (Node.js Express + Native PostgreSQL)** on **[Render.com](https://render.com)**
- **Frontend (React + Vite SPA)** on **[Netlify](https://netlify.com)**
- **Database** on **[Neon.tech](https://neon.tech)**

---

## 🏗️ Architecture Overview

```
[ Visitor / Admin / Student ]
            │
            ▼
┌─────────────────────────┐          API Requests (CORS / Cookies)
│   Netlify (Frontend)    │ ──────────────────────────────────────────► ┌─────────────────────────┐
│ https://<site>.netlify.app│                                           │    Render (Backend)     │
└─────────────────────────┘                                             │ https://<api>.onrender.com│
                                                                        └───────────┬─────────────┘
                                                                                    │ Native pg (SSL)
                                                                                    ▼
                                                                        ┌─────────────────────────┐
                                                                        │    Neon PostgreSQL      │
                                                                        │  (Cloud Serverless DB)  │
                                                                        └─────────────────────────┘
```

---

## Part 1: Deploy Backend to Render.com

### Step 1.1: Create Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository: `rajisankar06/Sri-Ruthralaya`.
4. Configure service settings:
   - **Name**: `sri-ruthralaya-backend` (or your preferred name)
   - **Region**: Choose closest to India/Singapore (e.g. `Singapore` or `Frankfurt`)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: `Free`

### Step 1.2: Set Backend Environment Variables
Under the **Environment Variables** section on Render, add these exact keys:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security, CORS, and logging |
| `PORT` | `5000` | Server port (Render will also automatically route traffic) |
| `DATABASE_URL` | *Your Neon PostgreSQL connection string* | e.g. `postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | *Strong 64+ char random string* | Used to sign access tokens |
| `JWT_REFRESH_SECRET` | *Strong 64+ char random string* | Used to sign refresh tokens |
| `FRONTEND_URL` | `https://sri-ruthralaya.netlify.app` | *Update with your actual Netlify domain after Part 2* |
| `GEMINI_API_KEY` | *Your Google Gemini API Key* | (Optional) Enables live Gemini AI chatbot & insights |
| `OPENAI_API_KEY` | *(Optional)* | Fallback AI provider |
| `ANTHROPIC_API_KEY` | *(Optional)* | Fallback AI provider |
| `CLOUDINARY_URL` | *(Optional)* | Cloud media storage (defaults to local `/uploads` if not set) |
| `EMAIL_USER` | *(Optional)* | Gmail or SMTP email address for sending password recovery OTPs |
| `EMAIL_PASS` | *(Optional)* | Google 16-character App Password (from myaccount.google.com/apppasswords) |

> [!TIP]
> The backend server has intelligent CORS matching that automatically supports `.netlify.app` subdomains and deploy preview URLs. If `EMAIL_USER` and `EMAIL_PASS` are omitted, the server will provide the recovery OTP in the API response so you are never locked out during development.

### Step 1.3: Deploy and Copy Backend URL
1. Click **Deploy Web Service**.
2. Wait 1–2 minutes for the build to finish.
3. Test your health check endpoint in the browser:
   `https://<your-render-app-name>.onrender.com/api/v1/health`
   You should see:
   ```json
   {
     "success": true,
     "data": {
       "status": "healthy",
       "database": "connected"
     }
   }
   ```
4. Copy your backend URL: `https://<your-render-app-name>.onrender.com`.

---

## Part 2: Deploy Frontend to Netlify

The repository includes both root `netlify.toml`, `frontend/netlify.toml`, and `_redirects` for automatic SPA client-side routing.

### Step 2.1: Create Site on Netlify
1. Log in to [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** > **Import an existing project**.
3. Select **GitHub** and authorize access to `rajisankar06/Sri-Ruthralaya`.
4. Configure site build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (or `frontend/dist`)
   - **Production branch**: `main`

### Step 2.2: Add Environment Variables in Netlify
Before clicking Deploy, click **Add environment variables** (or configure them under **Site configuration > Environment variables**):

| Key | Value |
| :--- | :--- |
| `VITE_API_BASE_URL` | `https://<your-render-app-name>.onrender.com/api/v1` |
| `VITE_APP_NAME` | `Sri Ruthralaya Bharathanatyam Academy` |
| `VITE_ACADEMY_PHONE` | `+91 98421 23456` |
| `VITE_ACADEMY_LOCATION` | `Thiruthangal near Sivakasi, Tamil Nadu` |

> [!IMPORTANT]
> Make sure `VITE_API_BASE_URL` ends with `/api/v1` and points to your Render backend URL.

### Step 2.3: Deploy Site
1. Click **Deploy Site**.
2. Netlify will build the Vite bundle (usually takes ~30 seconds).
3. Once deployed, Netlify will provide your site URL: `https://<random-name>.netlify.app` (e.g., `https://sri-ruthralaya.netlify.app`).
4. (Optional) Go to **Site configuration > Domain management** to change the site name to `sri-ruthralaya` or add a custom domain.

---

## Part 3: Connect Frontend & Backend (Final CORS Step)

1. Return to your **Render Dashboard** > **sri-ruthralaya-backend** > **Environment**.
2. Update the `FRONTEND_URL` variable with your actual Netlify URL:
   ```env
   FRONTEND_URL="https://your-site-name.netlify.app,http://localhost:5173"
   ```
3. Click **Save Changes**. Render will automatically redeploy the backend with the new configuration.

---

## Part 4: Verification & Smoke Test

1. Open your Netlify site URL in your browser.
2. Check public pages:
   - **Home**: Banner, batches, cultural philosophy, upcoming events.
   - **About Guru**: Credentials of Guru Nattiyakalaimani V. Suriya Sathian.
   - **Courses / Batches**: Fee structure, schedules.
   - **Gallery**: Photo & video showcase.
   - **Chatbot**: Click the bottom-right floating icon and ask `"What are the class timings?"` or `"Tell me about Guru V. Suriya Sathian"`.
3. Test Administrator Login:
   - Go to `/login`.
   - Email: `admin@sriruthralaya.com`
   - Password: `Admin@123`
   - Go to `/admin/dashboard`.
   - Verify that the status pill shows `🟢 PostgreSQL Engine Online`.
   - Test approving a student or recording an attendance entry.
4. Test Student Portal:
   - Disciples can log in with their email to view personal attendance percentages, fee receipts, and batch timings.
