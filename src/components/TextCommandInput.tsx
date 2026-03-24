import { useState, type FormEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function TextCommandInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg" aria-label="Enviar comando de texto">
      <div className="flex gap-2">
        <label htmlFor="text-command" className="sr-only">Comando de texto</label>
        <input
          id="text-command"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder="Digite um comando (ex: 'iniciar partida')..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5
                     text-sm text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                     disabled:text-gray-500 text-white text-sm font-medium rounded-lg
                     transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                     active:scale-95"
          aria-label="Enviar comando"
        >
          Enviar
        </button>
      </div>
    </form>
  );
}
