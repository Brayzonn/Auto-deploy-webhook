require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process'); 
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const getRawBody = require('raw-body');

const app = express();
const PORT = process.env.PORT || 9000;

const WEBHOOK_SECRET    =  process.env.WEBHOOK_SECRET;
const ALLOWED_BRANCHES  =  (process.env.ALLOWED_BRANCHES || 'main,master').split(',');
const DEPLOYMENT_SCRIPT =  process.env.DEPLOYMENT_SCRIPT;

//helper functions
if (!WEBHOOK_SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
} 

if (!DEPLOYMENT_SCRIPT) {
  console.error('DEPLOYMENT_SCRIPT environment variable is required');
  process.exit(1);
}

if (!fs.existsSync(DEPLOYMENT_SCRIPT) || !isValidScriptPath(DEPLOYMENT_SCRIPT)) {
  console.error(`Invalid deployment script path: ${DEPLOYMENT_SCRIPT}`);
  process.exit(1);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: 'Too many requests from this IP, please try again later'
});

function isValidScriptPath(scriptPath) {
  if (/[;&|`$<>]/.test(scriptPath)) {
    return false;
  }
  const normalizedPath = path.normalize(scriptPath);
  return path.isAbsolute(normalizedPath);
}

function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature || !signature.startsWith('sha256=')) {
    console.error('Invalid signature format');
    return false;
  }
  
  if (!req.rawBody) {
    console.error('Raw body not available');
    return false;
  }
  
  try {
    const sig = signature.substring(7); 
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = hmac.update(req.rawBody).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(digest, 'hex')
    );
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}


app.use('/githubwebhook', limiter);

app.use('/githubwebhook', (req, res, next) => {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8'
  }, (err, string) => {
    if (err) return next(err);
    req.rawBody = string; 
    next();
  });
});

app.use(express.json({ limit: '1mb' }));

app.post('/githubwebhook', (req, res) => {
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'] || 'unknown'; 
  let payload;
  
  console.log(`Received ${event} event (ID: ${deliveryId})`);
  
  try {
    payload = JSON.parse(req.rawBody);
  } catch (e) {
    console.error('Failed to parse webhook payload:', e);
    return res.status(400).send('Invalid JSON payload');
  }
  
  if (!verifyGitHubSignature(req)) {
    console.error(`Invalid signature for delivery ID: ${deliveryId}`);
    return res.status(401).send('Invalid signature');
  }
  
  if (event === 'ping') {
    console.log('Received ping event from GitHub - webhook configured successfully');
    return res.status(200).send('Webhook configured successfully');
  }
  
  if (event === 'push') {
    const repoFullName = payload.repository.full_name; 
    const branch = payload.ref.replace('refs/heads/', ''); 
    
    const deployScriptPath = DEPLOYMENT_SCRIPT;
    console.log(`Using deployment script: ${deployScriptPath}`);
    
    if (!ALLOWED_BRANCHES.includes(branch)) {
      console.log(`Ignoring push to ${branch} branch for ${repoFullName}`);
      return res.status(200).send(`Ignored push to ${branch} branch`);
    }
    
    console.log(`Processing push event for repository: ${repoFullName}`);
    console.log(`Branch: ${branch}`);
    console.log(`Commit: ${payload.after.substring(0, 7)} by ${payload.pusher.name}`);
    console.log(`Deploy script: ${deployScriptPath}`);
    
    if (!fs.existsSync(deployScriptPath)) {
      console.error(`Deployment script not found: ${deployScriptPath}`);
      return res.status(500).send('Deployment error: Script not found');
    }
    
    console.log(`Executing deployment script for ${repoFullName}...`);
    
    const env = {
      ...process.env, 
      GITHUB_REPO_FULL_NAME: repoFullName,
      GITHUB_REPO_NAME: payload.repository.name,
      GITHUB_REPO_OWNER: payload.repository.owner.name || payload.repository.owner.login,
      GITHUB_BRANCH: branch,
      GITHUB_COMMIT: payload.after,
      GITHUB_PUSHER: payload.pusher.name
    };
    
    exec(`bash ${deployScriptPath}`, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Deployment error for ${repoFullName}: ${error}`);
        return;
      }
      
      console.log(`Deployment output for ${repoFullName}: ${stdout}`);
      if (stderr) {
        console.error(`Deployment stderr for ${repoFullName}: ${stderr}`);
      }
      
      console.log(`Deployment completed successfully for ${repoFullName}:${branch}`);
    });
    
    return res.status(200).send('Deployment started');
  } 
  
  return res.status(200).send(`Received ${event} event, but no action taken`);
});

app.listen(PORT, () => {
  console.log(`GitHub Webhook Deployer listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/githubwebhook`);
  console.log(`Allowed branches: ${ALLOWED_BRANCHES.join(', ')}`);
  console.log(`\nDeployment script: ${DEPLOYMENT_SCRIPT}`);
  console.log('All repositories will use this single deployment script');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});