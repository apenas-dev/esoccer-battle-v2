#!/bin/bash
# download-models.sh — Download Whisper ONNX models for E-Soccer Battle
#
# The encoder_model.onnx and tokenizer.json are in the repo via git LFS.
# The decoder_model_merged.onnx was removed and needs manual download.
#
# Usage: ./scripts/download-models.sh
#
# Models should be placed in: src-tauri/models/whisper/

set -euo pipefail

MODEL_DIR="src-tauri/models/whisper"
mkdir -p "$MODEL_DIR"

echo "=== E-Soccer Battle — Whisper Model Downloader ==="
echo ""

# Check if encoder exists
if [ -f "$MODEL_DIR/encoder_model.onnx" ]; then
    echo "✓ encoder_model.onnx found ($(du -h "$MODEL_DIR/encoder_model.onnx" | cut -f1))"
else
    echo "✗ encoder_model.onnx missing — restore via: git lfs pull --include='src-tauri/models/whisper/encoder_model.onnx'"
fi

# Check if tokenizer exists
if [ -f "$MODEL_DIR/tokenizer.json" ]; then
    echo "✓ tokenizer.json found ($(du -h "$MODEL_DIR/tokenizer.json" | cut -f1))"
else
    echo "✗ tokenizer.json missing — restore via: git show f4bc577:src-tauri/models/whisper/tokenizer.json > $MODEL_DIR/tokenizer.json"
fi

# Decoder — needs manual download
if [ -f "$MODEL_DIR/decoder_model_merged.onnx" ]; then
    echo "✓ decoder_model_merged.onnx found ($(du -h "$MODEL_DIR/decoder_model_merged.onnx" | cut -f1))"
else
    echo ""
    echo "✗ decoder_model_merged.onnx MISSING — this is the main model file (~200MB)"
    echo ""
    echo "  To obtain it, you can:"
    echo ""
    echo "  Option 1: Export from Hugging Face transformers"
    echo "    pip install optimum"
    echo '    optimum export onnx --model openai/whisper-tiny --task automatic-speech-recognition --framework pt "$MODEL_DIR/tmp"'
    echo "    # Then merge encoder+decoder if needed, or use split models"
    echo ""
    echo "  Option 2: Download pre-exported ONNX from Hugging Face"
    echo "    https://huggingface.co/openai/whisper-tiny/tree/main"
    echo ""
    echo "  Option 3: Restore from original LFS (if you have LFS access)"
    echo "    git lfs fetch --include='src-tauri/models/whisper/decoder_model_merged.onnx'"
    echo "    git checkout 7bce290 -- src-tauri/models/whisper/decoder_model_merged.onnx"
    echo ""
    echo "  Place the file at: $MODEL_DIR/decoder_model_merged.onnx"
fi

echo ""
echo "=== Done ==="
