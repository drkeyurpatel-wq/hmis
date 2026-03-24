#!/bin/bash
# scripts/download-health-icons.sh
# Downloads curated health icons from healthicons.org into public/health-icons/
# Source: github.com/resolvetosavelives/healthicons (CC0 / Public Domain)
# Run once: bash scripts/download-health-icons.sh

set -e

DEST="public/health-icons"
REPO_URL="https://raw.githubusercontent.com/resolvetosavelives/healthicons/main/public/icons/svg"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Health1 — Downloading Health Icons (CC0)        ║"
echo "╚══════════════════════════════════════════════════╝"

# Create directory structure
mkdir -p "$DEST/outline/specialties"
mkdir -p "$DEST/outline/body"
mkdir -p "$DEST/outline/devices"
mkdir -p "$DEST/outline/diagnostics"
mkdir -p "$DEST/outline/medications"
mkdir -p "$DEST/outline/procedures"
mkdir -p "$DEST/outline/places"
mkdir -p "$DEST/outline/people"
mkdir -p "$DEST/outline/blood"
mkdir -p "$DEST/outline/conditions"
mkdir -p "$DEST/outline/food"
mkdir -p "$DEST/outline/objects"
mkdir -p "$DEST/outline/vehicles"
mkdir -p "$DEST/filled/specialties"
mkdir -p "$DEST/filled/body"
mkdir -p "$DEST/filled/places"

# ─── Download function ────────────────────────────────────────────
download() {
  local variant=$1 # outline or filled
  local category=$2
  local name=$3
  local url="$REPO_URL/$variant/$category/$name.svg"
  local dest="$DEST/$variant/$category/$name.svg"

  if [ -f "$dest" ]; then
    echo "  ✓ $variant/$category/$name (cached)"
    return
  fi

  if curl -sf -o "$dest" "$url"; then
    echo "  ↓ $variant/$category/$name"
  else
    echo "  ✗ $variant/$category/$name (not found)"
  fi
}

echo ""
echo "Downloading outline icons..."

# Specialties (clinical departments)
download outline specialties cardiology
download outline specialties neurology
download outline specialties orthopedics
download outline specialties obstetrics
download outline specialties gynecology
download outline specialties mental-health
download outline specialties physiotherapy
download outline specialties dental

# Body parts
download outline body heart
download outline body kidney
download outline body lungs
download outline body stomach
download outline body ear
download outline body eye
download outline body skin
download outline body brain

# Devices
download outline devices ventilator
download outline devices stethoscope
download outline devices stethoscope-alt
download outline devices x-ray
download outline devices computer
download outline devices renal
download outline devices sterilization
download outline devices medical-equipment

# Diagnostics
download outline diagnostics microscope
download outline diagnostics lab
download outline diagnostics x-ray
download outline diagnostics ecg

# Medications
download outline medications intravenous
download outline medications pills
download outline medications syringe
download outline medications prescription

# Procedures
download outline procedures surgery
download outline procedures endoscopy

# Places
download outline places hospital
download outline places clinic
download outline places pharmacy-alt
download outline places emergency-post
download outline places cleaning
download outline places mortuary

# People
download outline people doctor
download outline people health-worker-form
download outline people community-health-worker
download outline people baby-0203m
download outline people baby-0306m
download outline people military-worker

# Blood
download outline blood blood-bag

# Conditions
download outline conditions malaria-testing

# Food
download outline food nutritional-supplement

# Objects
download outline objects coins
download outline objects health-data
download outline objects tools
download outline objects cloth

# Vehicles
download outline vehicles ambulance

echo ""
echo "Downloading filled icons (key departments only)..."
download filled specialties cardiology
download filled specialties neurology
download filled body heart
download filled body kidney
download filled places hospital
download filled places emergency-post

echo ""
TOTAL=$(find "$DEST" -name "*.svg" | wc -l)
echo "══════════════════════════════════════════════════"
echo "  Done! $TOTAL icons downloaded to $DEST/"
echo "══════════════════════════════════════════════════"
echo ""
echo "Usage in components:"
echo '  import HealthIcon from "@/components/ui/health-icon";'
echo '  <HealthIcon name="specialties/neurology" size={24} />'
