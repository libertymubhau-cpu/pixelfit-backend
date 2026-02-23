require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
// Replace with your actual frontend URL when you have one
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',        // VS Code Live Server
  'https://pixelfit.netlify.app',  // your Netlify URL (update this)
  'https://pixelfit.io',           // your domain when you buy one
  process.env.FRONTEND_URL,        // or set via env variable
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── IMPORTANT: Raw body needed for Stripe webhook verification ──────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// JSON body parser for all other routes
app.use(express.json());

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'PixelFit API running ✅', version: '1.0.0' });
});

// ─── CREATE CHECKOUT SESSION ─────────────────────────────────────────────────
// Called by the frontend when user clicks "Start Pro"
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || process.env.FRONTEND_URL,

      // 7-day free trial — user won't be charged until trial ends
      subscription_data: {
        trial_period_days: 7,
      },

      // Collect billing address for tax purposes (optional, remove if not needed)
      // billing_address_collection: 'required',

      // Allow promo codes (optional)
      allow_promotion_codes: true,
    });

    res.json({ sessionId: session.id });

  } catch (err) {
    console.error('❌ Checkout session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── VERIFY PRO STATUS ───────────────────────────────────────────────────────
// Call this on page load to check if a user is still an active subscriber
app.get('/api/pro-status', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ isPro: false, error: 'Email required' });
    }

    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return res.json({ isPro: false });
    }

    const customerId = customers.data[0].id;

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    // Also check trialing subscriptions
    const trialing = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1,
    });

    const isPro = subscriptions.data.length > 0 || trialing.data.length > 0;

    res.json({
      isPro,
      customerId,
      subscriptionStatus: isPro
        ? (subscriptions.data[0] || trialing.data[0]).status
        : 'none',
    });

  } catch (err) {
    console.error('❌ Pro status error:', err.message);
    res.status(500).json({ isPro: false, error: err.message });
  }
});

// ─── CUSTOMER PORTAL ─────────────────────────────────────────────────────────
// Lets Pro users manage/cancel their subscription without contacting you
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.FRONTEND_URL,
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ Portal session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── STRIPE WEBHOOK ──────────────────────────────────────────────────────────
// Stripe calls this automatically when payments succeed, fail, or subscriptions change
// Set this URL in: Stripe Dashboard → Developers → Webhooks → Add Endpoint
// URL: https://your-backend.railway.app/api/webhook
app.post('/api/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('✅ Payment completed:', session.customer_email);
      // TODO: Save to your database
      // e.g. db.users.update({ email: session.customer_email }, { isPro: true })
      break;
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      if (sub.status === 'canceled' || sub.status === 'unpaid') {
        console.log('🚫 Subscription cancelled/unpaid for customer:', sub.customer);
        // TODO: Revoke Pro access in your database
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('⚠️ Payment failed for:', invoice.customer_email);
      // TODO: Send a "payment failed" email to the user
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object;
      console.log('⏰ Trial ending soon for customer:', sub.customer);
      // TODO: Send a "trial ending" reminder email
      break;
    }

    default:
      // Unhandled event type — safe to ignore
      break;
  }

  res.json({ received: true });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   PixelFit API started                ║
  ║   Port: ${PORT}                           ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}               ║
  ╚═══════════════════════════════════════╝
  `);
});
