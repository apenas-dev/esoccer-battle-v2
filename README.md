# E-Soccer Battle v2

Aplicativo desktop para narração automática de partidas de e-soccer via comandos de voz.

## Stack

- **Desktop**: Tauri v2 + Rust
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **STT**: Whisper ONNX (whisper-base)
- **TTS**: Kokoro ONNX (82M)
- **Storage**: SQLite (rusqlite)

## Setup

```bash
# Instalar dependências frontend
npm install

# Baixar modelos ONNX (~160 MB)
chmod +x scripts/download-models.sh
./scripts/download-models.sh

# Desenvolvimento
npm run tauri dev

# Build produção
npm run tauri build
```

## Estrutura

```
src-tauri/src/
├── main.rs          # Entry point + Tauri commands
├── models.rs        # Structs: Match, Command, Doubt
├── stt.rs           # Whisper ONNX transcrição
├── tts.rs           # Kokoro ONNX síntese
└── audio_utils.rs   # Decodificação, resample, WAV

src/
├── App.tsx          # Componente principal
├── main.tsx         # Entry React
└── styles/index.css # Tailwind
```
