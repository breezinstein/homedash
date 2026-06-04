# GitHub Actions Docker Build

This repository includes GitHub Actions workflows to automatically build multi-architecture Docker images for both AMD64 and ARM64 platforms.

## Workflows

### 1. `docker-build.yml` (Simple)
A straightforward workflow that:
- Builds multi-architecture images (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry (GHCR)
- Runs on pushes to main/develop branches and tags
- Includes build attestation for security

### 2. `docker-advanced.yml` (Advanced)
A comprehensive workflow that includes:
- Multi-architecture builds (linux/amd64, linux/arm64)
- Support for both GHCR and Docker Hub
- Vulnerability scanning with Trivy
- Manual workflow dispatch
- Build attestation and security features

## Setup

### Required Secrets

For the advanced workflow that supports Docker Hub, you'll need to set up these repository secrets:

1. **DOCKERHUB_USERNAME** - Your Docker Hub username
2. **DOCKERHUB_TOKEN** - Your Docker Hub access token

To set up Docker Hub access token:
1. Go to Docker Hub → Account Settings → Security
2. Create a new access token
3. Add it as a repository secret

### Automatic Triggers

Both workflows trigger on:
- Push to `main` or `develop` branches
- New tags (for releases)
- Pull requests (build only, no push)

### Manual Triggers

The advanced workflow can be manually triggered from the Actions tab with options to:
- Push to Docker Hub (checkbox option)

## Image Locations

### GitHub Container Registry
- **Registry**: `ghcr.io`
- **Image**: `ghcr.io/yourusername/homedash`
- **Public**: Images are automatically linked to the repository

### Docker Hub (Optional)
- **Registry**: `docker.io`
- **Image**: `yourusername/homedash`
- **Requires**: DOCKERHUB_USERNAME and DOCKERHUB_TOKEN secrets

## Pulling Images

### From GitHub Container Registry
```bash
docker pull ghcr.io/yourusername/homedash:latest
```

### From Docker Hub
```bash
docker pull yourusername/homedash:latest
```

### Specific Architecture
```bash
# AMD64
docker pull --platform linux/amd64 ghcr.io/yourusername/homedash:latest

# ARM64
docker pull --platform linux/arm64 ghcr.io/yourusername/homedash:latest
```

## Image Tags

The workflows automatically create tags based on:
- `latest` - Latest build from main branch
- `main` - Latest build from main branch
- `develop` - Latest build from develop branch  
- `v1.2.3` - Semantic version tags
- `v1.2` - Major.minor version
- `v1` - Major version
- `main-abc1234` - Branch name + commit SHA

## Security Features

The advanced workflow includes:
- **Trivy vulnerability scanning** - Scans built images for security vulnerabilities
- **SARIF upload** - Results appear in GitHub Security tab
- **Build attestation** - Cryptographically signed build provenance
- **Least privilege** - Only required permissions granted

## Monitoring

Check the Actions tab in your repository to monitor build status. Failed builds will show:
- Build logs for debugging
- Security scan results
- Platform-specific build issues

## Local Testing

To test multi-architecture builds locally:

```bash
# Set up buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t homedash:test .

# Build and load for current platform
docker buildx build --platform linux/amd64 -t homedash:test --load .
```
