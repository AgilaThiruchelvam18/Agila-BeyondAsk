#!/bin/bash

# Script to switch between legacy and modular routes
# Usage: ./switch-to-modular.sh [on|off]

MODE=${1:-on}

if [ "$MODE" = "on" ]; then
    echo "🔄 Switching to MODULAR routes at /api/*"
    echo "   Frontend will use modular architecture without code changes"
    export USE_MODULAR_ROUTES=true
    echo "USE_MODULAR_ROUTES=true" > .env.modular
    echo "✅ Modular routes activated"
    echo "   Restart your server to apply changes"
elif [ "$MODE" = "off" ]; then
    echo "🔄 Switching to LEGACY routes at /api/*"
    echo "   Frontend will use original monolithic system"
    export USE_MODULAR_ROUTES=false
    echo "USE_MODULAR_ROUTES=false" > .env.modular
    echo "✅ Legacy routes activated"
    echo "   Restart your server to apply changes"
else
    echo "Usage: $0 [on|off]"
    echo "  on  - Use modular routes at /api/*"
    echo "  off - Use legacy routes at /api/*"
    exit 1
fi

echo ""
echo "Current environment file (.env.modular):"
cat .env.modular