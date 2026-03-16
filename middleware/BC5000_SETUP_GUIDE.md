# Health1 — Mindray BC-5000 Interface Setup Guide

## Overview
The Mindray BC-5000 sends CBC results over Ethernet (TCP/IP) using HL7 v2.3.1 protocol.
A middleware agent runs on a lab PC, receives data, and pushes to Health1 LIMS automatically.

```
BC-5000 → Ethernet → Lab PC (middleware) → Internet → Health1 LIMS API → Supabase
```

## What You Need
- [ ] Ethernet cable (RJ45) — one end in BC-5000, other in network switch
- [ ] Lab PC with Python 3.8+ installed (Windows 10/11 recommended)
- [ ] PC must be on same network as BC-5000
- [ ] PC must have internet access (to reach hmis-brown.vercel.app)

## Step 1: BC-5000 Configuration
Access the Service menu on the BC-5000 (may need service password from Mindray engineer):

1. **Service > Communication > Host Settings**
   - Connection Type: **TCP/IP**
   - Host IP Address: **[IP of lab PC]** (find with `ipconfig` on the PC)
   - Host Port: **6000**
   - Protocol: **HL7**

2. **Service > Communication > Data Output**
   - Auto-send Results: **ON**
   - Send to Host: **ON**
   - Include QC: **OFF** (or ON if you want QC data too)

3. **Service > Sample ID**
   - Barcode Reader: **ON** (if barcode scanner attached)
   - Sample ID Format: Ensure it matches Health1 barcode format (H1-LAB-YYMM-NNNN)

4. **Note the IP address of the BC-5000** (usually visible in Network Settings)

## Step 2: Lab PC Setup

### Install Python
1. Download Python 3.11+ from https://python.org
2. During install, CHECK "Add Python to PATH"
3. Open Command Prompt, verify: `python --version`

### Install dependencies
```cmd
pip install pyserial requests
```

### Download middleware files
Copy these files from the HMIS repo to the lab PC:
- `middleware/h1_middleware.py`
- `middleware/instruments.json`

### Configure instruments.json
Edit `instruments.json`:
- `host`: Leave as `"0.0.0.0"` (listens on all interfaces)
- `port`: Must match what you set on BC-5000 (default: 6000)
- `lims_url`: `"https://hmis-brown.vercel.app/api/instrument"`

### Open firewall port
```cmd
netsh advfirewall firewall add rule name="Health1 LIMS BC-5000" dir=in action=allow protocol=TCP localport=6000
```

## Step 3: Test

### Test with sample data (no analyzer needed)
```cmd
python h1_middleware.py --test
```
You should see:
```
  GLU → FBS: 95 mg/dL [N]
  CREA → CREAT: 1.1 mg/dL [N]
  AST → SGOT: 45 U/L [H]
Test complete: 3 results parsed
```

### Test with actual BC-5000
1. Start middleware: `python h1_middleware.py`
2. Run a test sample on BC-5000
3. Check middleware console — should show "Received X bytes via TCP"
4. Check LIMS at hmis-brown.vercel.app/lab — results should auto-populate

## Step 4: Run as Windows Service (Production)

### Option A: Task Scheduler (simple)
1. Open Task Scheduler
2. Create Basic Task: "Health1 LIMS Middleware"
3. Trigger: "When the computer starts"
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\Health1\h1_middleware.py`
   - Start in: `C:\Health1\`
5. Check "Run whether user is logged on or not"

### Option B: NSSM (recommended for production)
1. Download NSSM from https://nssm.cc
2. Run: `nssm install Health1Middleware`
3. Path: `C:\Python311\python.exe`
4. Arguments: `C:\Health1\h1_middleware.py`
5. Startup directory: `C:\Health1\`
6. Start service: `nssm start Health1Middleware`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | BC-5000 IP or port wrong, or firewall blocking |
| No data received | Check BC-5000 auto-send is ON, and Host IP matches PC |
| "No mappable results" | Parameter codes from BC-5000 don't match instruments.json |
| Results not in LIMS | Check lims_url, check SUPABASE_SERVICE_ROLE_KEY in Vercel |
| HGB value 10x too high | Unit conversion needed — HGB factor 0.1 in config |
| Middleware crashes | Check h1_middleware.log for error details |

## Parameter Mapping (BC-5000 → Health1 LIMS)

| BC-5000 Code | LIMS Code | Parameter | Unit |
|-------------|-----------|-----------|------|
| WBC | WBC | Total WBC Count | x10^3/uL |
| RBC | RBC | RBC Count | million/cumm |
| HGB | HB | Hemoglobin | g/dL |
| HCT | PCV | PCV / Hematocrit | % |
| MCV | MCV | MCV | fL |
| MCH | MCH | MCH | pg |
| MCHC | MCHC | MCHC | g/dL |
| PLT | PLT | Platelet Count | x10^3/uL |
| RDW-CV | RDW | RDW-CV | % |
| MPV | MPV | Mean Platelet Volume | fL |
| Neu% | NEUT | Neutrophils | % |
| Lym% | LYMPH | Lymphocytes | % |
| Mon% | MONO | Monocytes | % |
| Eos% | EOS | Eosinophils | % |
| Bas% | BASO | Basophils | % |

## Support
- Middleware logs: `h1_middleware.log` (same folder as script)
- LIMS API health: `https://hmis-brown.vercel.app/api/instrument`
- Mindray service (Gujarat): Contact local Mindray representative
