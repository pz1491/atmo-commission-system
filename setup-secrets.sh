#!/bin/bash

# ATMO Commission System - Setup Secrets Script
# Usage: ./setup-secrets.sh

set -e

echo "🔐 ATMO Commission System - Setup Secrets"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    echo "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: No project set${NC}"
    echo "Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓ Project: $PROJECT_ID${NC}"
echo ""

# Enable Secret Manager API
echo "🔧 Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --quiet
echo -e "${GREEN}✓ Secret Manager API enabled${NC}"
echo ""

# Prompt for LINE credentials
echo "Please enter your LINE Official Account credentials:"
echo ""

# LINE Access Token
echo -n "LINE Channel Access Token: "
read -s LINE_ACCESS_TOKEN
echo ""

if [ -z "$LINE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Error: LINE Access Token cannot be empty${NC}"
    exit 1
fi

# LINE Channel Secret
echo -n "LINE Channel Secret: "
read -s LINE_CHANNEL_SECRET
echo ""

if [ -z "$LINE_CHANNEL_SECRET" ]; then
    echo -e "${RED}❌ Error: LINE Channel Secret cannot be empty${NC}"
    exit 1
fi

echo ""
echo "Creating secrets..."

# Create or update line-access-token
if gcloud secrets describe line-access-token &> /dev/null; then
    echo -e "${YELLOW}⚠ Secret 'line-access-token' already exists. Adding new version...${NC}"
    echo -n "$LINE_ACCESS_TOKEN" | gcloud secrets versions add line-access-token --data-file=-
else
    echo "Creating secret 'line-access-token'..."
    echo -n "$LINE_ACCESS_TOKEN" | gcloud secrets create line-access-token --data-file=-
fi

# Create or update line-channel-secret
if gcloud secrets describe line-channel-secret &> /dev/null; then
    echo -e "${YELLOW}⚠ Secret 'line-channel-secret' already exists. Adding new version...${NC}"
    echo -n "$LINE_CHANNEL_SECRET" | gcloud secrets versions add line-channel-secret --data-file=-
else
    echo "Creating secret 'line-channel-secret'..."
    echo -n "$LINE_CHANNEL_SECRET" | gcloud secrets create line-channel-secret --data-file=-
fi

echo ""
echo "Setting IAM permissions..."

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Secret Manager access to Cloud Run service account
gcloud secrets add-iam-policy-binding line-access-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

gcloud secrets add-iam-policy-binding line-channel-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Secrets created successfully!${NC}"
echo "=========================================="
echo ""
echo "Secrets:"
echo "  • line-access-token"
echo "  • line-channel-secret"
echo ""
echo "View secrets:"
echo "  gcloud secrets list"
echo ""
echo "Next step:"
echo "  Run: ./deploy-gcp.sh"
echo ""
