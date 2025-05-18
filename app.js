require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 9000; 
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH;
const ALLOWED_BRANCHES = (process.env.ALLOWED_BRANCHES || 'main,master').split(',');


if (!WEBHOOK_SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

if (!DEPLOY_SCRIPT_PATH) {
  console.error('DEPLOY_SCRIPT_PATH environment variable is required');
  process.exit(1);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, 
  message: 'Too many requests from this IP, please try again later'
});

function verifySignature(payload, signature, secret) {
  if (!signature) return false;
  const sig = signature.split('=')[1];
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use('/githubwebhook', limiter);

app.post('/githubwebhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const payload = req.body;
  
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    console.log('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  if (event === 'push') {
    const branch = payload.ref.replace('refs/heads/', '');
    if (!ALLOWED_BRANCHES.includes(branch)) {
      console.log(`Ignoring push to ${branch} branch`);
      return res.status(200).send(`Ignored push to ${branch} branch`);
    }

    console.log('Received push event from GitHub');
    console.log(`Repository: ${payload.repository.full_name}`);
    console.log(`Branch: ${branch}`);
    
    if (!fs.existsSync(DEPLOY_SCRIPT_PATH)) {
      console.error(`Deployment script not found: ${DEPLOY_SCRIPT_PATH}`);
      return res.status(500).send('Deployment error: Script not found');
    }
    
    console.log('Executing deployment script...');
    exec(`bash ${DEPLOY_SCRIPT_PATH}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Deployment error: ${error}`);
        return;
      }
      
      console.log(`Deployment output: ${stdout}`);
      if (stderr) {
        console.error(`Deployment stderr: ${stderr}`);
      }
      
      console.log('Deployment completed');
    });
    
    res.status(200).send('Deployment started');
  } else {
    res.status(200).send(`Received ${event} event`);
  }
});


app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});