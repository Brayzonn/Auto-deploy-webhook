# Auto-deploy-webhook

A secure, production-ready Node.js/Express server that automates deployments from GitHub using webhooks. When code is pushed to your repository, this server automatically deploys the changes to your server using a single, configurable deployment script.

![Deployment Flow](https://raw.githubusercontent.com/brayzonn/Auto-deploy-webhook/main/assets/flowchart.png)

## Features

- **Secure**: Verifies GitHub webhook signatures to prevent unauthorized deployments
- **Flexible**: Supports multiple branches and repositories
- **Protected**: Includes rate limiting to prevent abuse
- **Lightweight**: Minimal dependencies and resource usage
- **Transparent**: Detailed logging for troubleshooting
- **Configurable**: Easy environment-based configuration
- **Multi-repo**: Single deployment script handles all repositories with contextual environment variables


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
   nano .env  
   ```

4. Set up your deployment script:
   ```bash
   # Create scripts directory in your preferred location
   mkdir -p ~/scripts
   
   # Create and edit the deployment script
   nano ~/scripts/deploy.sh
   
   # Make the script executable
   chmod +x ~/scripts/deploy.sh
   
   # Note the full path for your .env file
   echo "Your script path is: $(realpath ~/scripts/deploy.sh)"  
   ```
   
5. Start the server:
   ```bash
   # For development
   npm run dev
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server configuration
PORT=your_port_number*

# Security
WEBHOOK_SECRET=your_github_webhook_secret_here

# Deployment
DEPLOYMENT_SCRIPT=/absolute/path/to/scripts/deploy.sh
ALLOWED_BRANCHES=main,master
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

7. Now you can use `systemctl --user start nginx-restart.service` in your deployment script.


## Creating a deployment Script
The webhook server passes contextual information about the GitHub event to your deployment script through environment variables. Your script can access:

- GITHUB_REPO_FULL_NAME: Full repository name (e.g., "username/repo-name")
- GITHUB_REPO_NAME: Repository name only
- GITHUB_REPO_OWNER: Repository owner username
- GITHUB_BRANCH: Branch that was pushed to
- GITHUB_COMMIT: Full commit hash
- GITHUB_PUSHER: Username of the person who pushed


### Example Deployment Script

For a complete, production-ready deployment script that handles multiple project types and repositories, see the example script in my repository:

**[View Complete Deployment Script Example](https://github.com/Brayzonn/github-webhook-deployer/blob/main/deploy.sh)**

This example script demonstrates:
- Multi-repository configuration
- Different project types (CLIENT, API_JS, API_TS)
- Full-stack and API-only deployment handling
- Comprehensive error handling and logging
- Real-world deployment scenarios

### Basic Script Structure

Here's the basic structure for accessing the GitHub context variables:

```bash
#!/bin/bash

# GitHub context variables (automatically provided by webhook server)
echo "Deploying: ${GITHUB_REPO_FULL_NAME}"
echo "Branch: ${GITHUB_BRANCH}"
echo "Commit: ${GITHUB_COMMIT:0:7}"
echo "Pushed by: ${GITHUB_PUSHER}"

# Your deployment logic here based on repository name
case "$GITHUB_REPO_NAME" in
    "your-repo-name")
        # Repository-specific deployment steps
        ;;
    *)
        echo "Unknown repository: $GITHUB_REPO_NAME"
        exit 1
        ;;
esac
```

## Security Considerations

1. **Webhook Secret**: Use a strong, random secret for your GitHub webhook.
   ```bash
   # Generate a secure random string
   openssl rand -hex 20
   ```

2. **Script Path Validation**: The server validates deployment script paths to prevent command injection.

3. **Rate Limiting**: Built-in rate limiting prevents abuse (10 requests per 15 minutes per IP).

4. **Limited Permissions**: Run your deployment script with the minimum necessary permissions.

5. **Secure Server Access**: Ensure your server has proper firewall rules and only accepts HTTPS connections.

## Troubleshooting

### Webhook Not Triggering

1. Check GitHub webhook delivery logs in your repository settings
2. Verify your server is accessible from the internet
3. Ensure your `WEBHOOK_SECRET` matches the one in GitHub
4. Check server logs for delivery IDs and error messages

### Deployment Script Failing

1. Run the script manually with the same environment variables:
   ```bash
   GITHUB_REPO_FULL_NAME="username/repo" \
   GITHUB_REPO_NAME="repo" \
   GITHUB_BRANCH="main" \
   GITHUB_COMMIT="abc123..." \
   GITHUB_PUSHER="username" \
   bash /path/to/your/deploy.sh
   ```
2. Check for permission issues with file directories
3. Examine the webhook server logs for detailed error output
4. Verify the `DEPLOYMENT_SCRIPT` path is absolute and executable


## License

[MIT](LICENSE)

---

Feel free to contribute to this project by opening issues and pull requests!