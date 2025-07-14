# 🧹 Container Cleanup Guide

## ⚠️ Known Issue: Orphaned Docker Containers

**Claude Desktop has a known bug where MCP Docker containers are not properly terminated when you:**
- Close a chat session
- Start a new chat
- Exit Claude Desktop

This results in **orphaned containers** accumulating in Docker Desktop.

## 🔍 Check for Orphaned Containers

```bash
# See all running axiom8-mcp containers
docker ps --filter "ancestor=axiom8-mcp:latest"

# See all axiom8-mcp containers (running + stopped)
docker ps -a --filter "ancestor=axiom8-mcp:latest"
```

## 🧹 Cleanup Solutions

### Option 1: Use Our Cleanup Script (Recommended)

```bash
# Make the script executable (first time only)
chmod +x scripts/cleanup-containers.sh

# Run the cleanup
./scripts/cleanup-containers.sh
```

### Option 2: Manual Cleanup

```bash
# Stop all running axiom8-mcp containers
docker stop $(docker ps -q --filter "ancestor=axiom8-mcp:latest")

# Remove all axiom8-mcp containers
docker rm $(docker ps -aq --filter "ancestor=axiom8-mcp:latest")

# Clean up any other orphaned containers
docker container prune -f
```

### Option 3: Nuclear Option (Clean Everything)

```bash
# ⚠️ WARNING: This removes ALL stopped containers
docker container prune -f

# ⚠️ WARNING: This removes ALL unused images
docker image prune -f
```

## 📊 Impact Assessment

**Good news**: Orphaned containers consume minimal resources when idle:
- **CPU**: ~0%
- **Memory**: ~5-10MB each
- **Disk**: Negligible

**Main issue**: Visual clutter in Docker Desktop

## 🔄 Recommended Workflow

1. **Use axiom8-mcp normally** - it works perfectly despite the cleanup issue
2. **Run cleanup script weekly** or when you notice many containers
3. **Monitor with**: `docker ps --filter "ancestor=axiom8-mcp:latest"`

## 🔮 Future Resolution

This is a **Claude Desktop bug**, not an axiom8-mcp issue. Expected fixes:
- **Docker MCP Toolkit**: New container management system
- **Claude Desktop updates**: Better process lifecycle management

## 🆘 Troubleshooting

### "Container name already exists" error
```bash
# If you see this error, run cleanup first:
./scripts/cleanup-containers.sh
# Then try starting Claude Desktop again
```

### Multiple containers running simultaneously
```bash
# This is normal - each Claude chat session creates a new container
# Use cleanup script to remove old ones
./scripts/cleanup-containers.sh
```

### Out of disk space
```bash
# Clean everything Docker-related
docker system prune -af
# ⚠️ WARNING: This removes ALL unused Docker data
```

---

**Remember**: The axiom8-mcp functionality works perfectly - this is just a housekeeping issue! 🏠✨