#!/usr/bin/env python3
"""
Health1 LIMS Instrument Middleware Agent
========================================
Runs on a Windows/Linux PC in the lab. Connects to clinical analyzers
via Serial (RS-232) or TCP/IP, parses ASTM/HL7 data, and sends results
to Health1 LIMS API.

INSTALLATION:
  pip install pyserial requests

USAGE:
  python h1_middleware.py --config instruments.json

CONFIG FILE (instruments.json):
[
  {
    "id": "hematology_1",
    "name": "Sysmex XN-550",
    "protocol": "hl7",
    "connection": "tcp",
    "host": "192.168.1.100",
    "port": 4000,
    "parameter_map": { "WBC": "WBC", "RBC": "RBC", "HGB": "HB", ... },
    "lims_url": "https://hmis-brown.vercel.app/api/instrument"
  },
  {
    "id": "biochem_1",
    "name": "Beckman AU680",
    "protocol": "astm",
    "connection": "serial",
    "com_port": "COM3",
    "baud_rate": 9600,
    "data_bits": 8,
    "parity": "N",
    "stop_bits": 1,
    "parameter_map": { "GLU": "FBS", "CREA": "CREAT", ... },
    "lims_url": "https://hmis-brown.vercel.app/api/instrument"
  }
]
"""

import argparse
import json
import logging
import os
import re
import socket
import sys
import threading
import time
from datetime import datetime

try:
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False
    print("[WARN] pyserial not installed. Serial connections disabled. Install: pip install pyserial")

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("[ERROR] requests not installed. Install: pip install requests")
    sys.exit(1)

# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('h1_middleware.log', encoding='utf-8'),
    ]
)
logger = logging.getLogger('H1-Middleware')

# ASTM control chars
ENQ = b'\x05'
STX = b'\x02'
ETX = b'\x03'
EOT = b'\x04'
ACK = b'\x06'
NAK = b'\x15'
CR = b'\r'
LF = b'\n'


# ============================================================
# ASTM PARSER
# ============================================================
def parse_astm(raw_data: str, param_map: dict) -> list:
    """Parse ASTM E1394 data into structured results."""
    results = []
    current_sample_id = ''
    current_patient_id = ''
    
    lines = raw_data.replace('\x02', '').replace('\x03', '').replace('\x05', '').replace('\x04', '')
    for line in lines.split('\r'):
        line = line.strip()
        if not line:
            continue
        
        # Strip frame number
        line = re.sub(r'^\d+', '', line)
        fields = line.split('|')
        record_type = fields[0] if fields else ''
        
        if record_type == 'P':
            current_patient_id = fields[2].split('^')[0] if len(fields) > 2 else ''
        
        elif record_type == 'O':
            current_sample_id = fields[2].split('^')[0] if len(fields) > 2 else ''
        
        elif record_type == 'R':
            test_parts = fields[2].split('^') if len(fields) > 2 else []
            instrument_code = test_parts[3] if len(test_parts) > 3 else (test_parts[0] if test_parts else '')
            value = fields[3] if len(fields) > 3 else ''
            unit = fields[4] if len(fields) > 4 else ''
            flag = fields[6] if len(fields) > 6 else 'N'
            
            lims_code = param_map.get(instrument_code)
            if lims_code:
                results.append({
                    'sampleId': current_sample_id,
                    'patientId': current_patient_id,
                    'limsParameterCode': lims_code,
                    'instrumentParameterCode': instrument_code,
                    'value': value.strip(),
                    'unit': unit,
                    'abnormalFlag': flag,
                })
    
    return results


# ============================================================
# HL7 PARSER
# ============================================================
def parse_hl7(raw_data: str, param_map: dict) -> list:
    """Parse HL7 v2.x ORU message into structured results."""
    results = []
    current_sample_id = ''
    patient_id = ''
    
    segments = raw_data.replace('\r\n', '\r').replace('\n', '\r').split('\r')
    
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        
        fields = seg.split('|')
        seg_type = fields[0]
        
        if seg_type == 'PID' and len(fields) > 3:
            patient_id = fields[3].split('^')[0]
        
        elif seg_type == 'OBR' and len(fields) > 3:
            current_sample_id = fields[2].split('^')[0] if len(fields) > 2 else ''
        
        elif seg_type == 'OBX' and len(fields) > 5:
            obs_id = fields[3].split('^')[0] if len(fields) > 3 else ''
            obs_name = fields[3].split('^')[1] if len(fields) > 3 and '^' in fields[3] else obs_id
            value = fields[5] if len(fields) > 5 else ''
            unit = fields[6].split('^')[0] if len(fields) > 6 else ''
            flag = fields[8] if len(fields) > 8 else ''
            
            lims_code = param_map.get(obs_id) or param_map.get(obs_name)
            if lims_code:
                results.append({
                    'sampleId': current_sample_id,
                    'patientId': patient_id,
                    'limsParameterCode': lims_code,
                    'instrumentParameterCode': obs_id,
                    'value': value.strip(),
                    'unit': unit,
                    'abnormalFlag': flag,
                })
    
    return results


def generate_hl7_ack(msg_control_id: str) -> str:
    """Generate HL7 ACK response."""
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"MSH|^~\\&|H1LIMS|HEALTH1|||{ts}||ACK|{ts}|P|2.3.1\rMSA|AA|{msg_control_id}\r"


# ============================================================
# SEND TO LIMS API
# ============================================================
def send_to_lims(lims_url: str, instrument_id: str, sample_barcode: str, results: list, retries: int = 3) -> dict:
    """Send parsed results to Health1 LIMS API."""
    payload = {
        'instrumentId': instrument_id,
        'sampleBarcode': sample_barcode,
        'results': results,
    }
    
    for attempt in range(retries):
        try:
            resp = requests.post(
                f"{lims_url}?action=results",
                json=payload,
                timeout=30,
                headers={'Content-Type': 'application/json'},
            )
            data = resp.json()
            if resp.status_code == 200 and data.get('success'):
                logger.info(f"LIMS: {data.get('saved', 0)} results saved for {sample_barcode}")
                if data.get('criticalAlerts'):
                    for alert in data['criticalAlerts']:
                        logger.critical(f"CRITICAL ALERT: {alert['parameter']} = {alert['value']}")
                return data
            else:
                logger.warning(f"LIMS error: {data.get('error', 'unknown')} (attempt {attempt+1})")
        except Exception as e:
            logger.error(f"LIMS send failed (attempt {attempt+1}): {e}")
        
        if attempt < retries - 1:
            time.sleep(2 ** attempt)
    
    return {'error': 'Failed after retries'}


# ============================================================
# SERIAL LISTENER
# ============================================================
class SerialListener(threading.Thread):
    """Listens on a serial port for ASTM data from an analyzer."""
    
    def __init__(self, config: dict):
        super().__init__(daemon=True)
        self.config = config
        self.name = f"Serial-{config['id']}"
        self.running = True
        self.buffer = b''
    
    def run(self):
        if not HAS_SERIAL:
            logger.error(f"{self.config['id']}: pyserial not installed")
            return
        
        while self.running:
            try:
                port = serial.Serial(
                    port=self.config.get('com_port', 'COM1'),
                    baudrate=self.config.get('baud_rate', 9600),
                    bytesize=self.config.get('data_bits', 8),
                    parity=self.config.get('parity', 'N'),
                    stopbits=self.config.get('stop_bits', 1),
                    timeout=1,
                )
                logger.info(f"{self.config['id']}: Connected on {port.port}")
                
                self.buffer = b''
                in_session = False
                
                while self.running:
                    data = port.read(1024)
                    if not data:
                        continue
                    
                    if ENQ in data:
                        port.write(ACK)
                        in_session = True
                        self.buffer = b''
                        logger.debug(f"{self.config['id']}: Session started (ENQ)")
                    
                    if in_session:
                        self.buffer += data
                        
                        # Check for end of frame
                        if ETX in data or EOT in data:
                            port.write(ACK)
                        
                        if EOT in data:
                            in_session = False
                            self._process_buffer()
                
                port.close()
                
            except serial.SerialException as e:
                logger.error(f"{self.config['id']}: Serial error: {e}. Retrying in 10s...")
                time.sleep(10)
            except Exception as e:
                logger.error(f"{self.config['id']}: Unexpected error: {e}")
                time.sleep(5)
    
    def _process_buffer(self):
        raw = self.buffer.decode('ascii', errors='ignore')
        logger.info(f"{self.config['id']}: Received {len(raw)} bytes")
        
        param_map = self.config.get('parameter_map', {})
        
        if self.config.get('protocol') == 'hl7':
            results = parse_hl7(raw, param_map)
        else:
            results = parse_astm(raw, param_map)
        
        if not results:
            logger.warning(f"{self.config['id']}: No mappable results in data")
            return
        
        # Extract sample barcode (first sampleId found)
        barcode = results[0].get('sampleId', '')
        logger.info(f"{self.config['id']}: Parsed {len(results)} results for sample {barcode}")
        
        send_to_lims(
            self.config.get('lims_url', ''),
            self.config['id'],
            barcode,
            results,
        )
        
        self.buffer = b''
    
    def stop(self):
        self.running = False


# ============================================================
# TCP LISTENER
# ============================================================
class TCPListener(threading.Thread):
    """Listens on TCP for HL7/ASTM data from network-connected analyzers."""
    
    def __init__(self, config: dict):
        super().__init__(daemon=True)
        self.config = config
        self.name = f"TCP-{config['id']}"
        self.running = True
    
    def run(self):
        host = self.config.get('host', '0.0.0.0')
        port = self.config.get('port', 4000)
        
        while self.running:
            try:
                server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                server.settimeout(5)
                server.bind((host, port))
                server.listen(1)
                logger.info(f"{self.config['id']}: Listening on {host}:{port}")
                
                while self.running:
                    try:
                        conn, addr = server.accept()
                        logger.info(f"{self.config['id']}: Connection from {addr}")
                        threading.Thread(target=self._handle_connection, args=(conn,), daemon=True).start()
                    except socket.timeout:
                        continue
                
                server.close()
                
            except Exception as e:
                logger.error(f"{self.config['id']}: TCP error: {e}. Retrying in 10s...")
                time.sleep(10)
    
    def _handle_connection(self, conn: socket.socket):
        conn.settimeout(30)
        buffer = b''
        
        try:
            while True:
                data = conn.recv(4096)
                if not data:
                    break
                
                buffer += data
                
                # For HL7: look for message end (last segment + CR)
                # For ASTM: look for EOT
                if EOT in data or (b'\rMSA|' in buffer) or (len(buffer) > 100 and not data):
                    break
            
            if buffer:
                raw = buffer.decode('ascii', errors='ignore')
                logger.info(f"{self.config['id']}: Received {len(raw)} bytes via TCP")
                
                param_map = self.config.get('parameter_map', {})
                
                if self.config.get('protocol') == 'hl7':
                    results = parse_hl7(raw, param_map)
                    # Send ACK
                    msg_id = ''
                    for line in raw.split('\r'):
                        if line.startswith('MSH'):
                            parts = line.split('|')
                            msg_id = parts[9] if len(parts) > 9 else ''
                    if msg_id:
                        conn.sendall(generate_hl7_ack(msg_id).encode())
                else:
                    results = parse_astm(raw, param_map)
                    conn.sendall(ACK)
                
                if results:
                    barcode = results[0].get('sampleId', '')
                    logger.info(f"{self.config['id']}: Parsed {len(results)} results for {barcode}")
                    send_to_lims(self.config.get('lims_url', ''), self.config['id'], barcode, results)
                else:
                    logger.warning(f"{self.config['id']}: No mappable results")
        
        except socket.timeout:
            logger.debug(f"{self.config['id']}: Connection timeout")
        except Exception as e:
            logger.error(f"{self.config['id']}: Connection error: {e}")
        finally:
            conn.close()
    
    def stop(self):
        self.running = False


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='Health1 LIMS Instrument Middleware')
    parser.add_argument('--config', default='instruments.json', help='Path to instrument config JSON')
    parser.add_argument('--test', action='store_true', help='Test mode — parse sample data and exit')
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        logger.error(f"Config file not found: {args.config}")
        logger.info("Creating sample config file...")
        sample = [
            {
                "id": "hematology_1",
                "name": "Sysmex XN-550",
                "protocol": "hl7",
                "connection": "tcp",
                "host": "0.0.0.0",
                "port": 4000,
                "parameter_map": {
                    "WBC": "WBC", "RBC": "RBC", "HGB": "HB", "HCT": "PCV",
                    "PLT": "PLT", "MCV": "MCV", "MCH": "MCH", "MCHC": "MCHC",
                },
                "lims_url": "https://hmis-brown.vercel.app/api/instrument"
            },
            {
                "id": "biochem_1",
                "name": "Beckman AU680",
                "protocol": "astm",
                "connection": "serial",
                "com_port": "COM3",
                "baud_rate": 9600,
                "parameter_map": {
                    "GLU": "FBS", "CREA": "CREAT", "BUN": "BUN",
                    "CHOL": "TCHOL", "TG": "TG", "AST": "SGOT", "ALT": "SGPT",
                },
                "lims_url": "https://hmis-brown.vercel.app/api/instrument"
            }
        ]
        with open(args.config, 'w') as f:
            json.dump(sample, f, indent=2)
        logger.info(f"Sample config written to {args.config}. Edit and restart.")
        return
    
    with open(args.config) as f:
        instruments = json.load(f)
    
    logger.info(f"Loading {len(instruments)} instrument(s)...")
    
    if args.test:
        # Test with sample ASTM data
        sample_astm = "1H|\\^&|||Beckman AU680|||||||E1394-97|20260317\r2P|1||PAT001\r3O|1|H1-2603-0001||^^^GLU\r4R|1|^^^GLU|95|mg/dL|70-100|N||F\r5R|2|^^^CREA|1.1|mg/dL|0.6-1.2|N||F\r6R|3|^^^AST|45|U/L|5-40|H||F\r7L|1\r"
        logger.info("Test: Parsing sample ASTM data...")
        results = parse_astm(sample_astm, instruments[0].get('parameter_map', {}))
        for r in results:
            logger.info(f"  {r['instrumentParameterCode']} → {r['limsParameterCode']}: {r['value']} {r['unit']} [{r['abnormalFlag']}]")
        logger.info(f"Test complete: {len(results)} results parsed")
        return
    
    listeners = []
    for inst in instruments:
        conn_type = inst.get('connection', 'tcp')
        if conn_type == 'serial':
            listener = SerialListener(inst)
        else:
            listener = TCPListener(inst)
        listener.start()
        listeners.append(listener)
        logger.info(f"Started {conn_type} listener for {inst['name']} ({inst['id']})")
    
    logger.info(f"Middleware running with {len(listeners)} listener(s). Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        for l in listeners:
            l.stop()


if __name__ == '__main__':
    main()
