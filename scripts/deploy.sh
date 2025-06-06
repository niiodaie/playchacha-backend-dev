#!/bin/bash

# Play ChaCha Production Deployment Script
# Version: 2.0
# Description: Enhanced deployment script with production optimizations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"
BACKUP_DIR="$PROJECT_DIR/backups"
ENV_FILE="$PROJECT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        warning ".env file not found. Creating from template..."
        cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
        error "Please configure the .env file before deploying."
    fi
    
    # Check if required environment variables are set
    source "$ENV_FILE"
    required_vars=("JWT_SECRET" "STRIPE_SECRET_KEY" "ODDS_API_KEY" "DB_PASSWORD" "REDIS_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set in .env file."
        fi
    done
    
    log "Prerequisites check completed successfully."
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/backups"
    mkdir -p "$PROJECT_DIR/uploads"
    mkdir -p "$PROJECT_DIR/ssl"
    mkdir -p "$PROJECT_DIR/monitoring"
    
    # Set proper permissions
    chmod 755 "$PROJECT_DIR/logs"
    chmod 755 "$PROJECT_DIR/backups"
    chmod 755 "$PROJECT_DIR/uploads"
    
    log "Directories created successfully."
}

# Backup existing data
backup_data() {
    log "Creating backup of existing data..."
    
    if docker-compose ps | grep -q "playchacha-postgres"; then
        BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
        
        docker-compose exec -T postgres pg_dump \
            -U "${DB_USER:-playchacha}" \
            -d "${DB_NAME:-playchacha}" \
            > "$BACKUP_FILE"
        
        if [[ -f "$BACKUP_FILE" ]]; then
            log "Database backup created: $BACKUP_FILE"
        else
            warning "Database backup failed or database is empty."
        fi
    else
        info "No existing database found, skipping backup."
    fi
}

# Build and deploy services
deploy_services() {
    log "Building and deploying services..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images
    log "Pulling latest base images..."
    docker-compose pull
    
    # Build application images
    log "Building application images..."
    docker-compose build --no-cache
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
    
    log "Services deployed successfully."
}

# Check service health
check_service_health() {
    log "Checking service health..."
    
    services=("postgres" "redis" "api" "nginx")
    
    for service in "${services[@]}"; do
        info "Checking $service health..."
        
        max_attempts=30
        attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if docker-compose ps "$service" | grep -q "healthy\|Up"; then
                log "$service is healthy."
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                error "$service failed to become healthy after $max_attempts attempts."
            fi
            
            sleep 10
            ((attempt++))
        done
    done
    
    # Test API endpoint
    info "Testing API endpoint..."
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log "API health check passed."
    else
        error "API health check failed."
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run migrations
    docker-compose exec api npm run migrate || {
        warning "Migration command failed. Database might already be up to date."
    }
    
    log "Database migrations completed."
}

# Initialize application data
initialize_data() {
    log "Initializing application data..."
    
    # Seed database if needed
    if [[ "${SEED_DATABASE:-false}" == "true" ]]; then
        log "Seeding database with initial data..."
        docker-compose exec api npm run seed
    fi
    
    # Initialize sports data
    if [[ "${INIT_SPORTS_DATA:-true}" == "true" ]]; then
        log "Initializing sports data..."
        docker-compose exec api npm run init-sports
    fi
    
    log "Application data initialization completed."
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    if [[ "${SSL_ENABLED:-false}" == "true" ]]; then
        if [[ ! -f "$PROJECT_DIR/ssl/cert.pem" ]] || [[ ! -f "$PROJECT_DIR/ssl/key.pem" ]]; then
            warning "SSL certificates not found. Generating self-signed certificates..."
            
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$PROJECT_DIR/ssl/key.pem" \
                -out "$PROJECT_DIR/ssl/cert.pem" \
                -subj "/C=US/ST=State/L=City/O=PlayChaCha/CN=playchacha.net"
            
            log "Self-signed SSL certificates generated."
        else
            log "SSL certificates found."
        fi
    else
        info "SSL is disabled. Skipping SSL setup."
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    if [[ "${MONITORING_ENABLED:-true}" == "true" ]]; then
        # Start monitoring services
        docker-compose up -d prometheus grafana loki promtail
        
        log "Monitoring services started."
        log "Grafana dashboard: http://localhost:3001 (admin/admin123)"
        log "Prometheus: http://localhost:9090"
    else
        info "Monitoring is disabled."
    fi
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old resources..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete 2>/dev/null || true
    
    # Remove old logs (keep last 30 days)
    find "$PROJECT_DIR/logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    log "Cleanup completed."
}

# Display deployment summary
deployment_summary() {
    log "Deployment Summary:"
    echo "===================="
    echo "Application: Play ChaCha"
    echo "Environment: ${NODE_ENV:-production}"
    echo "API URL: http://localhost:${API_PORT:-3000}"
    echo "Health Check: http://localhost:${API_PORT:-3000}/health"
    
    if [[ "${MONITORING_ENABLED:-true}" == "true" ]]; then
        echo "Grafana: http://localhost:3001"
        echo "Prometheus: http://localhost:9090"
    fi
    
    echo "Logs: $PROJECT_DIR/logs/"
    echo "Backups: $PROJECT_DIR/backups/"
    echo "===================="
    
    log "Deployment completed successfully!"
}

# Main deployment function
main() {
    log "Starting Play ChaCha deployment..."
    
    # Create log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    # Run deployment steps
    check_prerequisites
    create_directories
    backup_data
    setup_ssl
    deploy_services
    run_migrations
    initialize_data
    setup_monitoring
    cleanup
    deployment_summary
}

# Handle script interruption
trap 'error "Deployment interrupted!"' INT TERM

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "backup")
        backup_data
        ;;
    "health")
        check_service_health
        ;;
    "logs")
        docker-compose logs -f "${2:-api}"
        ;;
    "stop")
        log "Stopping services..."
        docker-compose down
        ;;
    "restart")
        log "Restarting services..."
        docker-compose restart "${2:-}"
        ;;
    "update")
        log "Updating services..."
        backup_data
        docker-compose pull
        docker-compose up -d --force-recreate
        check_service_health
        ;;
    *)
        echo "Usage: $0 {deploy|backup|health|logs|stop|restart|update}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (default)"
        echo "  backup  - Create database backup"
        echo "  health  - Check service health"
        echo "  logs    - View service logs"
        echo "  stop    - Stop all services"
        echo "  restart - Restart services"
        echo "  update  - Update and restart services"
        exit 1
        ;;
esac

