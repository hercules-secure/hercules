# Hercules

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Installation & Setup

### Method 1: Clone via Git

```bash
git clone https://github.com/hercules-secure/hercules.git
cd hercules

# Make executable
chmod +x hercules.sh

# Install dependencies
./hercules.sh install

# Start server
./hercules.sh start

# Start on custom port
PORT=3000 ./hercules.sh start

# Update server (stop, git pull, install dependencies, start)
./hercules.sh update

# Server status
./hercules.sh status

# Show all logs (both files)
./hercules.sh logs

# Show only combined.log
./hercules.sh logs-combined

# Show only errors.log
./hercules.sh logs-errors

# Follow combined.log in real-time
./hercules.sh logs-follow

# Follow errors.log in real-time
./hercules.sh logs-follow-errors

# Clear logs
./hercules.sh logs-clear

# Show log size
./hercules.sh logs-size

# Restart server
./hercules.sh restart

# Stop server
./hercules.sh stop

# Clean temporary files
./hercules.sh clean

# Help
./hercules.sh help
```

## Features

Composition Analysis

- Dependency statistics
- License compliance checking
- Reachability analysis
- Version analysis

Source Code Analysis

- Vulnerability and weakness detection
- Secret detection
- Data flow analysis
- Taint analysis
- Call graph analysis
- Reachability analysis

API Fuzzing

- API security analysis
- Automated test generation
- Attack replay
- REST API (OpenAPI / Swagger)
- gRPC (HTTP/2, Protobuf)
- GraphQL
- SOAP / XML-RPC

Threat Modeling

- Data flow diagrams (DFD)
- STRIDE threat library
- Ready-to-use strategy library

Integrations

- CI/CD integration
- Issue trackers
- Notifications

Report Formats

- HTML
- JSON
- PDF

Supported Sources

- GitHub / GitLab
- Archive / Local project
- Bitbucket / Enterprise repositories