import { useState, type FormEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function TextCommandInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Enviar comando de texto">
      <div className={`flex gap-2 p-1 rounded-xl transition-all duration-200 ${
        isFocused
          ? "bg-bg-card border border-accent-green/30 shadow-lg shadow-accent-green/5"
          : "bg-bg-card/60 border border-border-subtle"
      }`}>
        <label htmlFor="text-command" className="sr-only">Comando de texto</label>
        <input
          id="text-command"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="Digite um comando..."
          className="flex-1 bg-transparent px-4 py-2.5
                     text-sm text-white placeholder-gray-600
                     focus:outline-none
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium
                     transition-all duration-200
                     active:scale-95
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40
                     disabled:opacity-30 disabled:pointer-events-none
                     bg-accent-green text-bg-primary hover:bg-accent-green/90"
          aria-label="Enviar comando"
        >
          Enviar
        </button>
      </div>
      <p className="text-[10px] text-gray-700 mt-2 px-1">
        Ex: &ldquo;gol&rdquo;, &ldquo;volta&rdquo;, &ldquo;intervalo&rdquo;, &ldquo;iniciar partida&rdquo;, &ldquo;encerrar&rdquo;
      </p>
    </form>
  );
}
