# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for data and images
RUN mkdir -p /app/data /app/images

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Cloud Run will set PORT environment variable
ENV PORT=8080

# Expose port (Cloud Run ignores this but good for documentation)
EXPOSE 8080

# Run the application with gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
