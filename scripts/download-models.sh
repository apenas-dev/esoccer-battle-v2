#!/bin/bash
# download-models.sh — baixa modelos ONNX para STT (Whisper) e TTS (Kokoro)
# Uso: ./scripts/download-models.sh

set -e

MODELS_DIR="src-tauri/models"
WHISPER_DIR="$MODELS_DIR/whisper"
KOKORO_DIR="$MODELS_DIR/kokoro"
VOICES_DIR="$MODELS_DIR/voices"
mkdir -p "$WHISPER_DIR" "$KOKORO_DIR" "$VOICES_DIR"

echo "=== Download de Modelos ONNX ==="

# ── Whisper Base (encoder + decoder + tokenizer) ──────────────────────

WHISPER_ENCODER_URL="https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/encoder_model.onnx"
WHISPER_ENCODER_OUT="$WHISPER_DIR/encoder_model.onnx"

if [ -f "$WHISPER_ENCODER_OUT" ]; then
    echo "[OK] encoder_model.onnx já existe"
else
    echo "[..] Baixando whisper encoder (~75 MB)..."
    curl -L -o "$WHISPER_ENCODER_OUT" "$WHISPER_ENCODER_URL" --progress-bar
    echo "[OK] encoder_model.onnx baixado"
fi

WHISPER_DECODER_URL="https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/decoder_model_merged.onnx"
WHISPER_DECODER_OUT="$WHISPER_DIR/decoder_model_merged.onnx"

if [ -f "$WHISPER_DECODER_OUT" ]; then
    echo "[OK] decoder_model_merged.onnx já existe"
else
    echo "[..] Baixando whisper decoder (~145 MB)..."
    curl -L -o "$WHISPER_DECODER_OUT" "$WHISPER_DECODER_URL" --progress-bar
    echo "[OK] decoder_model_merged.onnx baixado"
fi

WHISPER_TOKENIZER_URL="https://huggingface.co/openai/whisper-base/resolve/main/tokenizer.json"
WHISPER_TOKENIZER_OUT="$WHISPER_DIR/tokenizer.json"

if [ -f "$WHISPER_TOKENIZER_OUT" ]; then
    echo "[OK] tokenizer.json já existe"
else
    echo "[..] Baixando whisper tokenizer (~0.5 MB)..."
    curl -L -o "$WHISPER_TOKENIZER_OUT" "$WHISPER_TOKENIZER_URL" --progress-bar
    echo "[OK] tokenizer.json baixado"
fi

# ── Kokoro-82M (modelo + tokenizer) ──────────────────────────────────

KOKORO_MODEL_URL="https://huggingface.co/onnx-community/kokoro-82m-onnx/resolve/main/model.onnx"
KOKORO_MODEL_OUT="$KOKORO_DIR/model.onnx"

if [ -f "$KOKORO_MODEL_OUT" ]; then
    echo "[OK] kokoro model.onnx já existe"
else
    echo "[..] Baixando kokoro-82m model.onnx (~82 MB)..."
    if curl -L -f -o "$KOKORO_MODEL_OUT" "$KOKORO_MODEL_URL" --progress-bar 2>/dev/null; then
        echo "[OK] kokoro model.onnx baixado"
    else
        echo "[!!] kokoro model.onnx não encontrado na URL esperada"
        echo "     Execute scripts/convert-kokoro-onnx.py para converter manualmente"
        rm -f "$KOKORO_MODEL_OUT"
    fi
fi

KOKORO_TOKENIZER_URL="https://huggingface.co/onnx-community/kokoro-82m-onnx/resolve/main/tokenizer.json"
KOKORO_TOKENIZER_OUT="$KOKORO_DIR/tokenizer.json"

if [ -f "$KOKORO_TOKENIZER_OUT" ]; then
    echo "[OK] kokoro tokenizer.json já existe"
else
    echo "[..] Baixando kokoro tokenizer.json..."
    if curl -L -f -o "$KOKORO_TOKENIZER_OUT" "$KOKORO_TOKENIZER_URL" --progress-bar 2>/dev/null; then
        echo "[OK] kokoro tokenizer.json baixado"
    else
        echo "[!!] kokoro tokenizer.json não encontrado"
        rm -f "$KOKORO_TOKENIZER_OUT"
    fi
fi

# ── Voice pack pf_dora (Portuguese Female Dora) ──────────────────────

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
echo "Whisper:"
ls -lh "$WHISPER_DIR/" 2>/dev/null || echo "  (vazio)"
echo "Kokoro:"
ls -lh "$KOKORO_DIR/" 2>/dev/null || echo "  (vazio)"
echo "Voices:"
ls -lh "$VOICES_DIR/" 2>/dev/null || echo "  (vazio)"
echo "Tamanho total:"
du -sh "$MODELS_DIR" 2>/dev/null
