import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, Settings, MessageCircle, Home, Bell, User, Sun, Moon, Hash, ChevronRight } from "lucide-react";
import "./_group.css";
import { BeeEyes, BeeEmotion } from "./BeeEyes";

const COLMEIA_TOOLS = [
  { name: 'Calendário', img: '/beeyes-design/images/calendario.png' },
  { name: 'Anotações',  img: '/beeyes-design/images/notas.png'       },
  { name: 'Finanças',   img: '/beeyes-design/images/financas.png'    },
  { name: 'Bee Core',   img: '/beeyes-design/images/icone-central.png' },
  { name: 'Alertas',    img: '/beeyes-design/images/alarmes.png'     },
  { name: 'Comunidades', img: null },
];

export function Mobile() {
  const [inputText, setInputText] = useState("");
  const [isDark, setIsDark] = useState(true);
  const [activeNav, setActiveNav] = useState<'feed' | 'colmeia' | 'chat' | 'alertas' | 'perfil'>('chat');
  const [emotion, setEmotion] = useState<BeeEmotion>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const emotions: BeeEmotion[] = ['idle', 'happy', 'thinking', 'surprised', 'sleepy', 'excited', 'focused'];
    const t = setInterval(() => {
      setEmotion(emotions[Math.floor(Math.random() * emotions.length)]);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, []);

  const d = isDark;
  const bg       = d ? '#1A1A1A' : '#FAFAF5';
  const surface  = d ? '#2A2A2A' : '#FFFFFF';
  const surface2 = d ? '#1F1F1F' : '#F5F0E8';
  const border   = d ? 'rgba(255,255,255,0.07)' : 'rgba(245,166,35,0.18)';
  const text     = d ? '#FFFFFF' : '#1A1A1A';
  const textSub  = d ? '#9CA3AF' : '#6B7280';

  return (
    <div
      className="flex items-center justify-center p-8 min-h-screen font-sans"
      style={{ background: d ? '#111111' : '#EDE8DF' }}
    >
      {/* Phone Frame */}
      <div
        className="relative w-[390px] h-[844px] rounded-[50px] shadow-2xl overflow-hidden flex flex-col"
        style={{ background: bg, border: '8px solid #0A0A0A' }}
      >
        {/* Status Bar */}
        <div className="h-[44px] w-full flex justify-between items-center px-6 pt-2 z-50 text-xs font-semibold" style={{ color: text }}>
          <span>9:41</span>
          <div className="flex space-x-1.5 items-center">
            <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><path d="M16 11V10H14V11H16ZM12 11V7H10V11H12ZM8 11V4H6V11H8ZM4 11V1H2V11H4Z"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 1.5C4.5 1.5 1.5 3 0 5L8 11L16 5C14.5 3 11.5 1.5 8 1.5Z"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="currentColor"><path d="M23 4H24V8H23V4ZM21 1H22V11H21V1ZM2 1H20V11H2V1ZM3 2V10H19V2H3Z" fillRule="evenodd" clipRule="evenodd"/><rect x="4" y="3" width="13" height="6" fill="currentColor"/></svg>
          </div>
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[120px] h-[32px] bg-black rounded-full z-50"></div>

        {/* App Content */}
        <div
          className={`flex-1 flex flex-col overflow-hidden relative ${d ? 'beeyes-bg-hex-pattern' : 'beeyes-bg-hex-pattern-light'}`}
        >
          {/* Header */}
          <div
            className={`px-5 pb-4 pt-10 flex items-center justify-between z-10 relative shadow-md ${d ? 'beeyes-glass' : 'beeyes-glass-light'}`}
            style={{ borderBottom: `1px solid ${border}` }}
          >
            {/* Left: icon only + compact name */}
            <div className="flex items-center gap-2 z-10" style={{ minWidth: 0, width: 80 }}>
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden beeyes-glow border-2 border-[#FFD700]">
                  <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2" style={{ borderColor: bg }}></div>
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm leading-tight truncate" style={{ color: text }}>Bee</h1>
                <span className="beeyes-gradient-bg text-[#1A1A1A] text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider">Lvl 12</span>
              </div>
            </div>

            {/* Center: animated eyes — absolutely centered */}
            <div
              className="absolute pointer-events-none flex items-center justify-center"
              style={{ left: 0, right: 0, top: 0, bottom: 0, zIndex: 5 }}
            >
              <div
                className="pointer-events-auto cursor-pointer"
                title={`Humor: ${emotion}`}
                onClick={() => {
                  const emotions: BeeEmotion[] = ['idle','happy','thinking','surprised','sleepy','excited','focused'];
                  setEmotion(emotions[Math.floor(Math.random() * emotions.length)]);
                }}
              >
                <BeeEyes emotion={emotion} size={30} isDark={isDark} />
              </div>
            </div>

            {/* Right: theme toggle */}
            <button
              onClick={() => setIsDark(!d)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10"
              style={{ background: d ? 'rgba(255,255,255,0.08)' : 'rgba(245,166,35,0.12)', color: d ? '#FFD700' : '#D4851A', border: `1px solid ${border}` }}
            >
              {d ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Screen: Chat */}
          {activeNav === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto beeyes-scrollbar p-5 pb-[130px] flex flex-col gap-5">
                <div className="flex justify-center my-1">
                  <span className="text-xs px-3 py-1 rounded-full backdrop-blur-sm" style={{ color: textSub, background: d ? 'rgba(0,0,0,0.4)' : 'rgba(245,166,35,0.12)' }}>
                    Hoje, 10:24
                  </span>
                </div>

                {/* Bee message */}
                <div className="flex gap-3 max-w-[85%]">
                  <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-auto mb-1 shadow" />
                  <div className="p-4 rounded-2xl rounded-bl-sm shadow-md text-[15px] leading-relaxed" style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                    Bom dia! 🐝 Percebi que você tem uma fatura do cartão vencendo na próxima sexta-feira (R$ 1.240,00). Quer que eu agende o pagamento?
                  </div>
                </div>

                {/* User message */}
                <div className="flex gap-3 max-w-[85%] self-end">
                  <div className="beeyes-gradient-bg text-[#1A1A1A] p-4 rounded-2xl rounded-br-sm shadow-lg text-[15px] leading-relaxed font-medium">
                    Sim, por favor! E me lembra de separar R$ 300 pra reserva de emergência.
                  </div>
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-auto mb-1">
                    <img src="https://ui-avatars.com/api/?name=Alex&background=F5A623&color=fff" alt="User" className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* Bee message with card */}
                <div className="flex gap-3 max-w-[90%]">
                  <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-auto mb-1 shadow" />
                  <div className="flex flex-col gap-1 w-full">
                    <div className="p-4 rounded-2xl rounded-bl-sm shadow-md text-[15px] leading-relaxed w-full" style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                      Tudo certo! Pagamento agendado e meta da reserva de emergência atualizada. 🍯✨
                      <div className="mt-4 p-3.5 rounded-xl" style={{ background: surface2, border: `1px solid ${border}` }}>
                        <div className="flex justify-between items-center mb-2.5">
                          <span className="text-sm font-medium" style={{ color: d ? '#D1D5DB' : '#4B5563' }}>Reserva de Emergência</span>
                          <span className="text-sm font-bold text-[#FFD700]">R$ 3.500 <span className="text-xs font-normal" style={{ color: textSub }}>/ 10k</span></span>
                        </div>
                        <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: d ? '#111' : '#E5E0D8' }}>
                          <div className="beeyes-gradient-bg h-2 rounded-full" style={{ width: '35%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Typing indicator */}
                <div className="flex gap-3 max-w-[85%]">
                  <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-auto mb-1 shadow" />
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm shadow-md flex items-center gap-1.5 h-11" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="absolute bottom-[90px] left-0 right-0 px-4 py-2 z-20">
                <div
                  className="rounded-full flex items-center p-1 shadow-lg"
                  style={{ background: d ? 'rgba(34,34,34,0.92)' : 'rgba(255,255,255,0.95)', border: `1px solid ${border}`, backdropFilter: 'blur(16px)' }}
                >
                  <button className="w-11 h-11 flex items-center justify-center rounded-full transition-colors" style={{ color: textSub }}>
                    <Mic size={20} />
                  </button>
                  <input
                    type="text"
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-transparent outline-none text-[15px]"
                    style={{ color: text }}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                  />
                  <button
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${inputText.trim() ? 'beeyes-gradient-bg text-[#1A1A1A]' : ''}`}
                    style={!inputText.trim() ? { background: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: textSub } : {}}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Screen: Colmeia */}
          {activeNav === 'colmeia' && (
            <div className="flex-1 overflow-y-auto beeyes-scrollbar p-5 pb-[100px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: text }}>Sua Colmeia</h2>
                <button className="text-xs text-[#F5A623] font-medium">Editar</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {COLMEIA_TOOLS.map((tool, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer ${d ? 'beeyes-tool-card-dark' : 'beeyes-tool-card-light'}`}
                  >
                    <div className="w-16 h-16 flex items-center justify-center">
                      {tool.img ? (
                        <img src={tool.img} alt={tool.name} className="w-full h-full object-contain drop-shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(147,51,234,0.15)' }}>
                          <Hash className="w-7 h-7 text-purple-400" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: d ? '#D1D5DB' : '#374151' }}>{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screen: Feed */}
          {activeNav === 'feed' && (
            <div className="flex-1 overflow-y-auto beeyes-scrollbar p-5 pb-[100px] flex flex-col gap-4">
              <h2 className="text-xl font-bold mb-2" style={{ color: text }}>Feed</h2>
              {[1, 2, 3].map(post => (
                <div key={post} className="rounded-2xl p-4" style={{ background: surface, border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <img src={`https://ui-avatars.com/api/?name=User+${post}&background=random&color=fff`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: text }}>Usuário {post}</p>
                      <p className="text-xs" style={{ color: textSub }}>Há 2 horas</p>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: d ? '#D1D5DB' : '#4B5563' }}>
                    Acabei de configurar minha Bee para gerenciar meus investimentos! 🐝✨
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Screen: Alertas */}
          {activeNav === 'alertas' && (
            <div className="flex-1 overflow-y-auto beeyes-scrollbar p-5 pb-[100px]">
              <h2 className="text-xl font-bold mb-4" style={{ color: text }}>Alertas</h2>
              {['Lembrete: Conta de luz às 10h', 'Nova missão disponível!', 'Resumo semanal pronto 📊'].map((alert, idx) => (
                <div key={idx} className="flex items-center gap-3 p-4 rounded-2xl mb-3" style={{ background: surface, border: `1px solid ${border}` }}>
                  <div className="w-10 h-10 shrink-0">
                    <img src="/beeyes-design/images/alarmes.png" alt="Alerta" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: text }}>{alert}</p>
                  <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color: textSub }} />
                </div>
              ))}
            </div>
          )}

          {/* Screen: Perfil */}
          {activeNav === 'perfil' && (
            <div className="flex-1 overflow-y-auto beeyes-scrollbar p-5 pb-[100px] flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#F5A623] mt-6 mb-4">
                <img src="https://ui-avatars.com/api/?name=Alex+Santos&background=F5A623&color=fff&size=200" alt="Perfil" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: text }}>Alex Santos</h2>
              <p className="text-sm mb-4" style={{ color: textSub }}>@alex.santos</p>
              <div className="flex gap-4 mb-6">
                {[['124', 'Amigos'], ['12', 'Nível'], ['48', 'Missões']].map(([val, lbl]) => (
                  <div key={lbl} className="flex flex-col items-center px-4 py-2 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
                    <span className="font-bold text-lg text-[#F5A623]">{val}</span>
                    <span className="text-xs" style={{ color: textSub }}>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className={`absolute bottom-0 left-0 right-0 h-[90px] flex justify-around items-start pt-3 pb-8 px-2 z-30 ${d ? 'beeyes-nav-glass' : 'beeyes-nav-glass-light'}`}>
            <button
              onClick={() => setActiveNav('feed')}
              className="flex flex-col items-center gap-1 w-16 transition-colors mt-1"
              style={{ color: activeNav === 'feed' ? '#F5A623' : textSub }}
            >
              <Home size={22} strokeWidth={2} />
              <span className="text-[10px] font-medium">Feed</span>
            </button>

            <button
              onClick={() => setActiveNav('colmeia')}
              className="flex flex-col items-center gap-1 w-16 transition-colors mt-1"
              style={{ color: activeNav === 'colmeia' ? '#F5A623' : textSub }}
            >
              <div className="w-6 h-6 rounded-md overflow-hidden">
                <img src="/beeyes-design/images/bee-icon.png" alt="Colmeia" className={`w-full h-full object-cover ${activeNav === 'colmeia' ? 'drop-shadow-[0_0_4px_rgba(245,166,35,0.7)]' : 'opacity-50'}`} />
              </div>
              <span className="text-[10px] font-medium">Colmeia</span>
            </button>

            {/* Chat (central elevated) */}
            <button
              onClick={() => setActiveNav('chat')}
              className="flex flex-col items-center gap-1 w-16 relative"
              style={{ color: activeNav === 'chat' ? '#FFD700' : textSub }}
            >
              <div
                className="absolute -top-[28px] p-[6px] rounded-full border shadow-lg z-50"
                style={{ background: bg, borderColor: d ? '#333' : '#E5E0D8', boxShadow: activeNav === 'chat' ? '0 0 20px rgba(245,166,35,0.4)' : 'none' }}
              >
                <div className="beeyes-gradient-bg w-12 h-12 rounded-full flex items-center justify-center text-white">
                  <MessageCircle size={24} fill="currentColor" stroke="none" />
                </div>
              </div>
              <span className="text-[10px] font-bold mt-[36px]">Chat</span>
            </button>

            <button
              onClick={() => setActiveNav('alertas')}
              className="flex flex-col items-center gap-1 w-16 relative transition-colors mt-1"
              style={{ color: activeNav === 'alertas' ? '#F5A623' : textSub }}
            >
              <Bell size={22} strokeWidth={2} />
              <span className="absolute top-0 right-3.5 w-2 h-2 bg-[#F5A623] rounded-full shadow-[0_0_5px_rgba(245,166,35,0.8)]"></span>
              <span className="text-[10px] font-medium">Alertas</span>
            </button>

            <button
              onClick={() => setActiveNav('perfil')}
              className="flex flex-col items-center gap-1 w-16 transition-colors mt-1"
              style={{ color: activeNav === 'perfil' ? '#F5A623' : textSub }}
            >
              <User size={22} strokeWidth={2} />
              <span className="text-[10px] font-medium">Perfil</span>
            </button>
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/30 rounded-full z-40"></div>
        </div>
      </div>
    </div>
  );
}
