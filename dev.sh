#!/bin/bash

# Homedash Development Script
# Usage: ./dev.sh [command]

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "🏠 Homedash Development Helper"
    echo "=============================="
    echo -e "${NC}"
}

show_help() {
    echo -e "${GREEN}Available commands:${NC}"
    echo "  setup     - Install dependencies and setup development environment"
    echo "  start     - Start the development server"
    echo "  build     - Build the application for production"
    echo "  docker    - Build and run Docker container"
    echo "  test      - Run tests"
    echo "  clean     - Clean build artifacts and node_modules"
    echo "  logs      - Show server logs"
    echo "  backup    - Create configuration backup"
    echo "  help      - Show this help message"
}

setup() {
    echo -e "${YELLOW}Setting up development environment...${NC}"
    
    # Install server dependencies
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
    
    # Create directories
    echo "📁 Creating data directories..."
    mkdir -p server/data
    mkdir -p server/data/backups
    
    # Copy environment file
    if [ ! -f .env ]; then
        echo "⚙️ Creating environment file..."
        cp .env.example .env
    fi
    
    echo -e "${GREEN}✅ Setup complete!${NC}"
    echo "Run './dev.sh start' to start the development server"
}

start_server() {
    echo -e "${YELLOW}Starting Homedash server...${NC}"
    cd server
    
    if [ "$1" == "dev" ]; then
        echo "🔧 Starting in development mode with nodemon..."
        npm run dev
    else
        echo "🚀 Starting in production mode..."
        npm start
    fi
}

build_docker() {
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t homedash .
    
    echo -e "${YELLOW}Starting Docker container...${NC}"
    docker run -p 3001:3001 -v homedash-data:/app/server/data homedash
}

run_docker_compose() {
    echo -e "${YELLOW}Starting with Docker Compose...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Homedash is running at http://localhost:3001${NC}"
}

clean() {
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    rm -rf server/node_modules
    rm -rf server/data/*.log
    echo -e "${GREEN}✅ Clean complete!${NC}"
}

show_logs() {
    echo -e "${YELLOW}Showing server logs...${NC}"
    if [ -f server/data/homedash.log ]; then
        tail -f server/data/homedash.log
    else
        echo "No log file found. Make sure the server is running."
    fi
}

create_backup() {
    echo -e "${YELLOW}Creating configuration backup...${NC}"
    timestamp=$(date +"%Y%m%d_%H%M%S")
    
    if [ -f server/data/config.json ]; then
        cp server/data/config.json "server/data/backups/manual-backup-${timestamp}.json"
        echo -e "${GREEN}✅ Backup created: manual-backup-${timestamp}.json${NC}"
    else
        echo -e "${RED}❌ No configuration file found${NC}"
    fi
}

# Main script logic
print_header

case "${1:-help}" in
    setup)
        setup
        ;;
    start)
        start_server "${2:-prod}"
        ;;
    dev)
        start_server "dev"
        ;;
    build)
        build_docker
        ;;
    docker)
        run_docker_compose
        ;;
    clean)
        clean
        ;;
    logs)
        show_logs
        ;;
    backup)
        create_backup
        ;;
    help|*)
        show_help
        ;;
esac
