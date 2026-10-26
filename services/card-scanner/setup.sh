#!/usr/bin/env bash
set -e

echo "=== VivrePlay Card Scanner VPS Setup ==="

# Check root or sudo
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo: sudo bash setup.sh"
  exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "1. Installing system dependencies..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv curl libgl1 libglib2.0-0

echo "2. Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip

echo "3. Installing PyTorch (CPU-optimized) and dependencies..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

echo "4. Setting up systemd service..."
cat <<EOF > /etc/systemd/system/card-scanner.service
[Unit]
Description=VivrePlay Card Scanner Service
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable card-scanner
systemctl restart card-scanner

echo "5. Verifying service..."
sleep 2
systemctl status card-scanner --no-pager

echo ""
echo "=== Setup complete! ==="
echo "Scanner running at: http://localhost:8000"
echo "Health check: curl http://localhost:8000/health"
