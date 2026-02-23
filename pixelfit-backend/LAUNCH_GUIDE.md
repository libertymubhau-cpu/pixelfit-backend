# PixelFit — Complete Launch Guide
## From zero to making money in under 1 hour

---

## PART 1 — Get Your Stripe Keys (5 mins)

1. Go to https://dashboard.stripe.com
2. Click **Developers → API Keys**
3. Copy your **Publishable key** (pk_live_xxx) → paste into `CFG.stripeKey` in the HTML file
4. Copy your **Secret key** (sk_live_xxx) → paste into `.env` as `STRIPE_SECRET_KEY`

> ⚠️ Use `pk_test_` and `sk_test_` keys first to test without real charges.

---

## PART 2 — Create Your Products in Stripe (5 mins)

1. Go to **Stripe Dashboard → Products → Add Product**
2. Create **Product 1:**
   - Name: `PixelFit Pro Monthly`
   - Price: `$5.00` / month (recurring)
   - Click Save → copy the **Price ID** (price_xxx)
   - Paste into `CFG.priceMonthly` in the HTML file

3. Create **Product 2:**
   - Name: `PixelFit Pro Yearly`
   - Price: `$39.00` / year (recurring)
   - Click Save → copy the **Price ID**
   - Paste into `CFG.priceYearly` in the HTML file

---

## PART 3 — Deploy the Backend to Railway (10 mins)

Railway gives you a free backend with a real HTTPS URL.

1. Go to https://railway.app → Sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
   - Or use **Deploy from local** if you haven't pushed to GitHub yet
3. Select your pixelfit-backend folder
4. Railway auto-detects Node.js and deploys it
5. Go to **Variables** tab and add:
   ```
   STRIPE_SECRET_KEY    = sk_live_xxx (or sk_test_xxx)
   STRIPE_WEBHOOK_SECRET = whsec_xxx  (get this in next step)
   FRONTEND_URL          = https://pixelfit.netlify.app
   NODE_ENV              = production
   ```
6. Copy your Railway URL (e.g. `https://pixelfit-backend.up.railway.app`)
7. Update `CFG.checkoutEndpoint` in the HTML:
   ```js
   checkoutEndpoint: 'https://pixelfit-backend.up.railway.app/api/create-checkout-session',
   ```

---

## PART 4 — Set Up Stripe Webhook (5 mins)

This tells Stripe to notify your backend when payments happen.

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Click **Add Endpoint**
3. URL: `https://your-railway-url.up.railway.app/api/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Click **Add Endpoint**
6. Click **Reveal signing secret** → copy it
7. Paste into Railway env vars as `STRIPE_WEBHOOK_SECRET`

---

## PART 5 — Deploy the Frontend to Netlify (5 mins)

1. Go to https://netlify.com → Sign up free
2. Drag and drop your `social-image-resizer.html` file onto the Netlify dashboard
3. Netlify gives you a free URL instantly (e.g. `https://amazing-name-123.netlify.app`)
4. Update `FRONTEND_URL` in your Railway env vars to match this URL
5. Update `CFG.successUrl` and `CFG.cancelUrl` in the HTML to use this URL

---

## PART 6 — Test End-to-End (10 mins)

1. Open your Netlify URL in browser
2. Upload an image and do 5 downloads (uses up free tier)
3. 6th download should trigger the paywall modal
4. Use Stripe test card: `4242 4242 4242 4242` / any expiry / any CVC
5. You should be redirected to success page and Pro should activate

---

## PART 7 — Go Live with Real Payments

1. In Stripe Dashboard → click **Activate account** (complete their verification)
2. Switch from `pk_test_` to `pk_live_` in the HTML
3. Switch from `sk_test_` to `sk_live_` in Railway env vars
4. Redeploy

---

## Revenue Projections

| Users/month | Conversion | Monthly Revenue |
|-------------|-----------|-----------------|
| 1,000       | 2%        | ~$100           |
| 5,000       | 2%        | ~$500           |
| 20,000      | 2%        | ~$2,000         |
| 100,000     | 2%        | ~$10,000        |

---

## Costs to Run This (almost zero)

| Service       | Cost        |
|---------------|-------------|
| Railway       | Free tier   |
| Netlify       | Free tier   |
| Stripe fees   | 2.9% + 30¢ per transaction |
| Domain (optional) | ~$12/year |
| **Total**     | **~$0 to start** |

---

## Quick Commands (local development)

```bash
# Install dependencies
npm install

# Copy env file and fill in your keys
cp .env.example .env

# Run in dev mode (auto-restarts on changes)
npm run dev

# Run in production
npm start
```

---

## Support
- Stripe Docs: https://stripe.com/docs
- Railway Docs: https://docs.railway.app
- Netlify Docs: https://docs.netlify.com
