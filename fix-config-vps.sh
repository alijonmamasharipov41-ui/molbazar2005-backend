#!/bin/bash
# VPS da: cd ~/molbazar2005-backend && bash fix-config-vps.sh

set -e
cd "$(dirname "$0")"
FILE="src/config.js"

# Qaysi qatorda PUBLIC_URL ekanini topamiz
LINE=$(grep -n "const PUBLIC_URL" "$FILE" | head -1 | cut -d: -f1)
if [ -z "$LINE" ]; then
  echo "PUBLIC_URL qatori topilmadi."
  exit 1
fi

# Shu qatorni to'g'ri qator bilan almashtirish
sed -i.bak "${LINE}s/.*/const PUBLIC_URL = process.env.PUBLIC_URL || process.env.API_BASE_URL || \"https:\/\/molbazar.uz\";/" "$FILE"

echo "O'zgartirildi: qator $LINE"
grep -n "PUBLIC_URL" "$FILE"
