#!/bin/bash
# scripts/generate-synthea.sh
# Generate synthetic patient data for HMIS dev/testing
# Source: github.com/synthetichealth/synthea (Apache 2.0)
#
# Prerequisites: Java 11+
# Usage: bash scripts/generate-synthea.sh [count]
#   Default: 200 patients

set -e

COUNT=${1:-200}
SYNTHEA_DIR="/tmp/synthea"
OUTPUT_DIR="/tmp/synthea-output"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Health1 — Synthea Test Data Generator           ║"
echo "║  Generating $COUNT synthetic patients             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Install Java 11+:"
    echo "   Ubuntu: sudo apt install default-jdk"
    echo "   Mac:    brew install openjdk@17"
    echo "   Windows: winget install Microsoft.OpenJDK.17"
    exit 1
fi
echo "✅ Java found: $(java -version 2>&1 | head -1)"

# Clone Synthea if not present
if [ ! -d "$SYNTHEA_DIR" ]; then
    echo "Downloading Synthea..."
    git clone --depth 1 https://github.com/synthetichealth/synthea.git "$SYNTHEA_DIR"
    echo "✅ Synthea downloaded"
else
    echo "✅ Synthea cached at $SYNTHEA_DIR"
fi

# Clean output
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Generate
echo ""
echo "Generating $COUNT patients (CSV + FHIR)..."
cd "$SYNTHEA_DIR"

./run_synthea \
    -p "$COUNT" \
    -s 42 \
    --exporter.baseDirectory "$OUTPUT_DIR" \
    --exporter.csv.export true \
    --exporter.fhir.export true \
    --exporter.fhir_r4.export true \
    --generate.only_alive_patients true \
    Massachusetts 2>&1 | grep -E "Running|Generated|records"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ $COUNT patients generated"
echo "═══════════════════════════════════════════════════"
echo ""
echo "CSV output: $OUTPUT_DIR/csv/"

if [ -d "$OUTPUT_DIR/csv" ]; then
    echo ""
    echo "Files:"
    for f in "$OUTPUT_DIR/csv/"*.csv; do
        rows=$(wc -l < "$f")
        echo "  $(basename $f): $((rows - 1)) rows"
    done
fi

echo ""
echo "Next: Import into HMIS Supabase (dev only):"
echo "  1. Run sql/synthea_test_data.sql in Supabase SQL editor"
echo "  2. node scripts/import-synthea.mjs"
