# convert-kokoro-onnx.py — converte modelo Kokoro PyTorch → ONNX
# 
# Requisitos:
#   pip install torch onnx onnxruntime kokoro-onnx
#
# Uso:
#   python scripts/convert-kokoro-onnx.py --output src-tauri/models/kokoro-82m.onnx
#
# NOTA: este script é um placeholder. A conversão real depende da
# disponibilidade do modelo Kokoro em formato PyTorch.

import argparse
import sys

def main():
    parser = argparse.ArgumentParser(description="Converte Kokoro PyTorch → ONNX")
    parser.add_argument("--output", default="src-tauri/models/kokoro-82m.onnx")
    parser.add_argument("--voice-pack", default="pf_dora")
    args = parser.parse_args()

    print(f"⚠️  Script placeholder — conversão real requer:")
    print(f"    1. Modelo Kokoro-82M em PyTorch")
    print(f"    2. Tokenizer/espeak-ng para PT-BR")
    print(f"    3. Voice pack: {args.voice_pack}")
    print(f"")
    print(f"Verificar: https://github.com/suno-ai/bark para alternativas")
    print(f"Ou usar kokoro-onnx WASM no frontend como fallback")
    sys.exit(1)

if __name__ == "__main__":
    main()
