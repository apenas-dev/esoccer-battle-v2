#!/bin/bash
# download-models.sh — baixa modelos ONNX para STT e TTS
# Uso: ./scripts/download-models.sh

set -e

MODELS_DIR="src-tauri/models"
VOICES_DIR="$MODELS_DIR/voices"
mkdir -p "$MODELS_DIR" "$VOICES_DIR"

echo "=== Download de Modelos ONNX ==="

# Whisper Base (~75 MB)
WHISPER_URL="https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/decoder_model_merged.onnx"
WHISPER_OUT="$MODELS_DIR/whisper-base.onnx"

if [ -f "$WHISPER_OUT" ]; then
    echo "[OK] whisper-base.onnx já existe"
else
    echo "[..] Baixando whisper-base (~75 MB)..."
    curl -L -o "$WHISPER_OUT" "$WHISPER_URL" --progress-bar
    echo "[OK] whisper-base.onnx baixado"
fi

# Kokoro-82M (~82 MB)
# NOTA: modelo pode não estar disponível publicamente como ONNX
# Se não baixar, usar script de conversão em scripts/convert-kokoro-onnx.py
KOKORO_URL="https://huggingface.co/onnx-community/kokoro-82m-onnx/resolve/main/model.onnx"
KOKORO_OUT="$MODELS_DIR/kokoro-82m.onnx"

if [ -f "$KOKORO_OUT" ]; then
    echo "[OK] kokoro-82m.onnx já existe"
else
    echo "[..] Baixando kokoro-82m (~82 MB)..."
    if curl -L -f -o "$KOKORO_OUT" "$KOKORO_URL" --progress-bar 2>/dev/null; then
        echo "[OK] kokoro-82m.onnx baixado"
    else
        echo "[!!] kokoro-82m.onnx não encontrado na URL esperada"
        echo "     Execute scripts/convert-kokoro-onnx.py para converter manualmente"
        rm -f "$KOKORO_OUT"
    fi
fi

# Voice pack pf_dora (Portuguese Female Dora)
VOICE_URL="https://huggingface.co/onnx-community/kokoro-82m-onnx/resolve/main/voices/pf_dora.bin"
VOICE_OUT="$VOICES_DIR/pf_dora.bin"

if [ -f "$VOICE_OUT" ]; then
    echo "[OK] pf_dora.bin já existe"
else
    echo "[..] Baixando voice pack pf_dora..."
    if curl -L -f -o "$VOICE_OUT" "$VOICE_URL" --progress-bar 2>/dev/null; then
        echo "[OK] pf_dora.bin baixado"
    else
        echo "[!!] pf_dora.bin não encontrado — TTS funcionará sem voz personalizada"
        rm -f "$VOICE_OUT"
    fi
fi

echo ""
echo "=== Resumo ==="
ls -lh "$MODELS_DIR"/*.onnx 2>/dev/null || echo "Nenhum modelo ONNX encontrado"
ls -lh "$VOICES_DIR"/*.bin 2>/dev/null || echo "Nenhum voice pack encontrado"
echo "Tamanho total:"
du -sh "$MODELS_DIR" 2>/dev/null
