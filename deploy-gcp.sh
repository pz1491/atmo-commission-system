#!/bin/bash

# ATMO Commission System - Google Cloud Run Deployment Script
# Usage: ./deploy-gcp.sh

set -e

echo "🚀 ATMO Commission System - Google Cloud Run Deployment"
echo "=========================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="atmo-commission"
REGION="asia-southeast1"
MEMORY="512Mi"
CPU="1"
TIMEOUT="300"
CONCURRENCY="80"
MIN_INSTANCES="0"
MAX_INSTANCES="10"

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

# Check if secrets exist
echo "🔍 Checking secrets..."
if ! gcloud secrets describe line-access-token &> /dev/null; then
    echo -e "${RED}❌ Error: Secret 'line-access-token' not found${NC}"
    echo ""
    echo "Please create secrets first:"
    echo "  echo -n 'YOUR_LINE_ACCESS_TOKEN' | gcloud secrets create line-access-token --data-file=-"
    echo "  echo -n 'YOUR_LINE_CHANNEL_SECRET' | gcloud secrets create line-channel-secret --data-file=-"
    exit 1
fi

if ! gcloud secrets describe line-channel-secret &> /dev/null; then
    echo -e "${RED}❌ Error: Secret 'line-channel-secret' not found${NC}"
    echo ""
    echo "Please create secrets first:"
    echo "  echo -n 'YOUR_LINE_CHANNEL_SECRET' | gcloud secrets create line-channel-secret --data-file=-"
    exit 1
fi

echo -e "${GREEN}✓ Secrets found${NC}"
echo ""

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable secretmanager.googleapis.com --quiet
echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Deploy
echo "📦 Deploying to Cloud Run..."
echo ""
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --platform managed \
  --memory $MEMORY \
  --cpu $CPU \
  --timeout $TIMEOUT \
  --concurrency $CONCURRENCY \
  --min-instances $MIN_INSTANCES \
  --max-instances $MAX_INSTANCES \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest" \
  --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")

echo ""
echo "=========================================================="
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo "=========================================================="
echo ""
echo "📍 Service URL: $SERVICE_URL"
echo "📍 Webhook URL: $SERVICE_URL/webhook"
echo ""
echo "Next steps:"
echo "1. Go to LINE Developers Console: https://developers.line.biz/console/"
echo "2. Set Webhook URL to: $SERVICE_URL/webhook"
echo "3. Enable 'Use webhook'"
echo "4. Click 'Verify' to test"
echo ""
echo "View logs:"
echo "  gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "View service:"
echo "  https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
echo ""
