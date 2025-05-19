# GitHub Webhook Deployer

A secure, production-ready Node.js server that automates deployments from GitHub using webhooks. When code is pushed to your repository, this server automatically deploys your changes to your server.

## Features

- 🔒 **Secure**: Verifies GitHub webhook signatures to prevent unauthorized deployments
- 🚀 **Flexible**: Supports multiple branches and repositories
- 🛡️ **Protected**: Includes rate limiting to prevent abuse
- 📦 **Lightweight**: Minimal dependencies and resource usage
- 🔍 **Transparent**: Detailed logging for troubleshooting
- 🧩 **Configurable**: Easy environment-based configuration

## Prerequisites

- Node.js v14 or higher
- npm or yarn
- A server with Git installed
- A GitHub repository with webhook access

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/github-webhook-deployer.git
   cd github-webhook-deployer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a configuration file:
   ```bash
   cp .env.example .env
   nano .env  
   ```

4. Set up your re-deployment script:
   ```bash
   # Create scripts directory in your preferred location
   mkdir -p ~/scripts
   
   # Create and edit the deployment script
   nano ~/scripts/redeploy.sh
   
   # Make the script executable
   chmod +x ~/scripts/redeploy.sh
   
   # Note the full path for your .env file
   echo "Your script path is: $(realpath ~/scripts/redeploy.sh)"  
   ```
   
5. Start the server:
   ```bash
   # For development
   npm run dev

   # For production (using PM2)
   npm install -g pm2
   pm2 start app.js --name "github-webhook"
   pm2 save
   pm2 startup
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server configuration
PORT=9000

# Security
WEBHOOK_SECRET=your_github_webhook_secret_here

# Re-deployment
RE_DEPLOY_SCRIPT_PATH=/absolute/path/to/scripts/deploy.sh
ALLOWED_BRANCHES=main,production,staging
```

### GitHub Webhook Setup

1. Go to your GitHub repository
2. Navigate to Settings > Webhooks
3. Click "Add webhook"
4. Set the Payload URL to `https://yourdomain.com/githubwebhook`
5. Set Content type to `application/json`
6. Set the Secret to the same value as your `WEBHOOK_SECRET`
7. Select "Just the push event" (or customize as needed)
8. Ensure "Active" is checked
9. Click "Add webhook"


### Setting Up User Services for nginx

1. Create a user service directory:
   ```bash
   mkdir -p ~/.config/systemd/user/
   ```

2. Create a service file for restarting nginx:
   ```bash
   nano ~/.config/systemd/user/nginx-restart.service
   ```

3. Add the following content:
   ```ini
   [Unit]
   Description=Restart Nginx without password

   [Service]
   Type=oneshot
   ExecStart=/bin/bash -c 'sudo systemctl restart nginx'

   [Install]
   WantedBy=default.target
   ```

4. Enable and reload the service:
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable nginx-restart.service
   ```

5. Configure sudo to allow this specific command without password:
   ```bash
   sudo visudo -f /etc/sudoers.d/nginx-restart
   ```

6. Add this line to the file:
   ```
   yourusername ALL=(ALL) NOPASSWD: /bin/systemctl restart nginx
   ```

7. Now you can use `systemctl --user start nginx-restart.service` in your re-deployment script instead of directly using sudo.


## Creating a Re-deployment Script
For automatic redeployment of your React TypeScript Vite application whenever you push to GitHub, create a dedicated script as follows:

```bash
#variables
REPO_DIR="/home/your-username/your-project"       # Local path to your cloned Git repository
WEB_ROOT="/var/www/html/your-project-name"        # Web server's public root for the project
BRANCH="main"                                      # Git branch to deploy from
                        

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' 

echo -e "${YELLOW}Starting re-deployment process...${NC}"

echo -e "${YELLOW}Navigating to repository directory...${NC}"
cd $REPO_DIR || { echo -e "${RED}Failed to change directory to $REPO_DIR${NC}"; exit 1; }


#github and local repo update
echo -e "${YELLOW}Fetching latest changes from GitHub...${NC}"
git fetch || { echo -e "${RED}Failed to fetch from GitHub${NC}"; exit 1; }

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}No changes to deploy. Your site is up to date!${NC}"
    exit 0
fi

echo -e "${YELLOW}Pulling latest changes from GitHub...${NC}"
git pull origin $BRANCH || { echo -e "${RED}Failed to pull from GitHub${NC}"; exit 1; }

echo -e "${YELLOW}Navigating to client directory...${NC}"
cd client || { echo -e "${RED}Failed to change directory to client${NC}"; exit 1; }

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install || { echo -e "${RED}Failed to install dependencies${NC}"; exit 1; }

echo -e "${YELLOW}Building the application...${NC}"
npm run build || { echo -e "${RED}Failed to build the application${NC}"; exit 1; }

echo -e "${YELLOW}Clearing existing files...${NC}"
rm -rf $WEB_ROOT/* || { echo -e "${RED}Failed to clear web root directory${NC}"; exit 1; }

echo -e "${YELLOW}Copying build files to web root...${NC}"
cp -r dist/* $WEB_ROOT/ || { echo -e "${RED}Failed to copy files to web root${NC}"; exit 1; }

echo -e "${YELLOW}Restarting Nginx...${NC}"
systemctl --user start nginx-restart.service

echo -e "${GREEN}Re-deployment completed successfully!${NC}"
```

Make sure to adapt this script to your specific needs.

## Security Considerations

1. **Webhook Secret**: Use a strong, random secret for your GitHub webhook.
   ```bash
   # Generate a secure random string
   openssl rand -hex 20
   ```

2. **Limited Permissions**: Run your re-deployment script with the minimum necessary permissions.

3. **Secure Server Access**: Ensure your server has proper firewall rules and only accepts HTTPS connections.

## Troubleshooting

### Webhook Not Triggering

1. Check GitHub webhook delivery logs in your repository settings
2. Verify your server is accessible from the internet
3. Ensure your `WEBHOOK_SECRET` matches the one in GitHub

### Re-deployment Script Failing

1. Run the script manually to see if it works
2. Check for permission issues with file directories
3. Examine the logs from the webhook server
4. Add more detailed error output to your script

## License

[MIT](LICENSE)

---

Feel free to contribute to this project by opening issues and pull requests!