#!/bin/bash
cd "$(dirname "$0")"
echo "[$(date)] Native Host started" >> native_host.log
echo "Current directory: $(pwd)" >> native_host.log
node native_app.js 2>> native_host.log
