import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, MessageSquare, Send, Check, X } from 'lucide-react';
import { ModelData } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { interpretCommand, AICommand, SceneContext } from '../services/AICommandService';

interface GeminiAssistantProps {
  context: SceneContext;
  onExecuteCommand: (command: AICommand) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  commands?: AICommand[];
}

export default function GeminiAssistant({ context, onExecuteCommand }: GeminiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: prompt
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);

    try {
      const response = await interpretCommand(userMessage.text, context);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.message,
        commands: response.commands
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: "Error communicating with Gemini."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = (command: AICommand, messageId: string, index: number) => {
    onExecuteCommand(command);
    // Mark command as executed (optional, could remove it or disable the button)
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.commands) {
        const newCommands = [...msg.commands];
        newCommands.splice(index, 1);
        return { ...msg, commands: newCommands };
      }
      return msg;
    }));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-[#151619] border border-white/10 rounded shadow-2xl w-96 mb-4 flex flex-col overflow-hidden"
            style={{ maxHeight: '600px', height: '600px' }}
          >
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-[11px] font-bold tracking-widest text-white/80">SCENE_ASSISTANT</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/30 hover:text-white text-[10px] font-mono transition-colors"
              >
                CLOSE_X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {messages.length === 0 && (
                <div className="text-center space-y-4 py-8">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest leading-relaxed">
                    AI_ASSISTANT_READY. HOW CAN I HELP YOU BUILD YOUR SCENE?
                  </p>
                  <div className="flex flex-col gap-2 px-4">
                    <button onClick={() => setPrompt("Add a tree here")} className="text-[9px] font-mono text-white/40 hover:text-white/80 text-left bg-white/5 p-2 rounded">"Add a tree here"</button>
                    <button onClick={() => setPrompt("Explain the selected object")} className="text-[9px] font-mono text-white/40 hover:text-white/80 text-left bg-white/5 p-2 rounded">"Explain the selected object"</button>
                    <button onClick={() => setPrompt("Suggest optimizations")} className="text-[9px] font-mono text-white/40 hover:text-white/80 text-left bg-white/5 p-2 rounded">"Suggest optimizations"</button>
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-100 border border-blue-500/30' : 'bg-black/40 text-white/80 border border-white/5'}`}>
                    <p className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap tracking-tight">
                      {msg.text}
                    </p>
                  </div>
                  
                  {msg.commands && msg.commands.length > 0 && (
                    <div className="mt-2 w-full space-y-2">
                      {msg.commands.map((cmd, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded p-2 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-mono text-white/60">{cmd.description}</span>
                            <span className="text-[8px] font-mono text-white/30 uppercase px-1 py-0.5 bg-black/40 rounded">{cmd.type}</span>
                          </div>
                          
                          <div className="flex justify-end gap-2 mt-1">
                            {cmd.requiresConfirmation ? (
                              <>
                                <button 
                                  onClick={() => handleExecute(cmd, msg.id, idx)}
                                  className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-[9px] font-mono transition-colors"
                                >
                                  <Check className="w-3 h-3" /> CONFIRM
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => handleExecute(cmd, msg.id, idx)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[9px] font-mono transition-colors"
                              >
                                EXECUTE
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-2 text-white/30">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[9px] font-mono uppercase tracking-widest">PROCESSING...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleCustomPrompt} className="p-3 bg-black/40 border-t border-white/5 flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="TYPE_COMMAND..."
                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded disabled:opacity-20 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded flex items-center justify-center shadow-2xl transition-all duration-300 border ${
          isOpen 
            ? 'bg-white/10 border-white/20 rotate-90 text-white' 
            : 'bg-[#151619] border-white/10 hover:border-white/20 text-white/50 hover:text-white'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>
    </div>
  );
}
