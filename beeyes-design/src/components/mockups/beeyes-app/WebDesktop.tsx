import React, { useState, useEffect } from 'react';
import {
  Bell, Users, User, Mic, Send, Image as ImageIcon,
  Settings, Search, MessageSquare, ChevronRight, Hash,
  Sun, Moon, Heart, Sparkles, Wallet, Home, Plus
} from 'lucide-react';
import './_group.css';
import { BeeEyes, BeeEmotion } from './BeeEyes';

const COLMEIA_TOOLS = [
  { name: 'Calendário', img: '/beeyes-design/images/calendario.png', label: 'Calendário' },
  { name: 'Anotações',  img: '/beeyes-design/images/notas.png',       label: 'Anotações'  },
  { name: 'Finanças',   img: '/beeyes-design/images/financas.png',    label: 'Finanças'   },
  { name: 'Bee Core',   img: '/beeyes-design/images/icone-central.png', label: 'Bee Core' },
  { name: 'Alertas',    img: '/beeyes-design/images/alarmes.png',     label: 'Alertas'    },
  { name: 'Saúde',      img: '/beeyes-design/images/saude.png',       label: 'Saúde'      },
];

export function WebDesktop() {
  const [activeTab, setActiveTab] = useState('Colmeia');
  const [isDark, setIsDark] = useState(true);
  const [emotion, setEmotion] = useState<BeeEmotion>('idle');

  // Cycle through emotions to demo the eyes reacting
  useEffect(() => {
    const sequence: BeeEmotion[] = ['idle', 'happy', 'idle', 'thinking', 'idle', 'excited', 'idle', 'focused', 'idle', 'surprised', 'idle', 'sleepy'];
    let i = 0;
    const run = () => {
      const delays: number[] = [4000, 2500, 3000, 3500, 3000, 2000, 4000, 3000, 5000, 2000, 3000, 4000];
      const timeout = setTimeout(() => {
        i = (i + 1) % sequence.length;
        setEmotion(sequence[i]);
        run();
      }, delays[i % delays.length]);
      return timeout;
    };
    const t = run();
    return () => clearTimeout(t);
  }, []);

  const d = isDark;

  const bg      = d ? '#1A1A1A' : '#FAFAF5';
  const surface = d ? '#2D2D2D' : '#FFFFFF';
  const border  = d ? 'rgba(255,255,255,0.07)' : 'rgba(245,166,35,0.18)';
  const text    = d ? '#FFFFFF' : '#1A1A1A';
  const textSub = d ? '#9CA3AF' : '#6B7280';
  const inputBg = d ? '#111111' : '#F5F0E8';

  return (
    <div
      className={`flex h-screen w-full overflow-hidden font-sans ${d ? 'beeyes-bg-hex-pattern' : 'beeyes-bg-hex-pattern-light'}`}
      style={{ color: text }}
    >
      {/* LEFT SIDEBAR */}
      <div
        className={`w-64 flex flex-col justify-between p-6 ${d ? 'beeyes-glass' : 'beeyes-glass-light'}`}
        style={{ borderRight: `1px solid ${border}` }}
      >
        <div>
          {/* Logo + Theme Toggle */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <img src="/beeyes-design/images/bee-icon.png" alt="Beeyes" className="w-10 h-10 rounded-xl object-cover beeyes-glow" />
              <h1 className="text-2xl font-bold beeyes-gradient-text tracking-tight">Beeyes</h1>
            </div>
            <button
              onClick={() => setIsDark(!d)}
              className="beeyes-theme-toggle"
              style={{ background: d ? 'rgba(255,255,255,0.08)' : 'rgba(245,166,35,0.12)', color: d ? '#FFD700' : '#D4851A' }}
              title={d ? 'Modo claro' : 'Modo escuro'}
            >
              {d ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {[
              { id: 'alertas', label: 'Alertas', icon: Bell, badge: 3 },
              { id: 'amigos',  label: 'Amigos',  icon: Users },
              { id: 'perfil',  label: 'Perfil',  icon: User  },
            ].map(item => (
              <button
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{ color: textSub }}
                onMouseEnter={e => (e.currentTarget.style.background = d ? 'rgba(45,45,45,0.7)' : 'rgba(245,166,35,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto beeyes-gradient-bg text-[#1A1A1A] text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div
          className="p-4 rounded-xl flex items-center gap-3 cursor-pointer transition-colors"
          style={{ background: d ? 'rgba(45,45,45,0.5)' : 'rgba(245,166,35,0.08)', border: `1px solid ${border}` }}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <img src="https://ui-avatars.com/api/?name=Alex&background=F5A623&color=fff" alt="User" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" style={{ color: text }}>Alex Santos</p>
            <p className="text-xs truncate" style={{ color: textSub }}>@alex.santos</p>
          </div>
          <Settings className="w-4 h-4" style={{ color: textSub }} />
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col relative" style={{ borderRight: `1px solid ${border}` }}>
        {/* Header */}
        <div
          className={`h-24 flex items-center justify-between px-8 z-10 relative ${d ? 'beeyes-glass' : 'beeyes-glass-light'}`}
          style={{ borderBottom: `1px solid ${border}` }}
        >
          {/* Left: icon + name */}
          <div className="flex items-center gap-3 z-10">
            <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-10 h-10 rounded-xl object-cover beeyes-glow shadow-md" />
            <div>
              <h2 className="text-base font-bold leading-tight" style={{ color: text }}>Bee Assistant</h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse"></div>
                <span className="text-[11px] text-[#F5A623]">Online</span>
              </div>
            </div>
          </div>

          {/* Center: animated eyes — absolutely centered */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
            <div
              className="pointer-events-auto cursor-pointer flex items-center gap-1"
              title={`Humor: ${emotion}`}
              onClick={() => {
                const emotions: BeeEmotion[] = ['idle','happy','thinking','surprised','sleepy','excited','focused'];
                setEmotion(emotions[Math.floor(Math.random() * emotions.length)]);
              }}
            >
              <BeeEyes emotion={emotion} size={44} isDark={isDark} />
            </div>
          </div>

          {/* Right: search */}
          <button className="p-2 rounded-full transition-colors z-10" style={{ color: textSub }}>
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 beeyes-scrollbar flex flex-col gap-6">
          <div className="text-center my-4">
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={{ color: textSub, background: d ? 'rgba(45,45,45,0.5)' : 'rgba(245,166,35,0.1)' }}
            >
              Hoje, 10:42 AM
            </span>
          </div>

          {/* Bee message */}
          <div className="flex items-start gap-4 max-w-[80%]">
            <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-1 shadow" />
            <div
              className="rounded-2xl rounded-tl-none px-5 py-3.5 text-sm leading-relaxed shadow-lg"
              style={{ background: d ? '#2D2D2D' : '#FFFFFF', border: `1px solid ${border}`, color: text }}
            >
              <p>Bom dia, Alex! 🐝 O seu resumo financeiro desta semana está pronto. Você economizou <strong>12%</strong> a mais do que na semana passada!</p>
              <div
                className="mt-3 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                style={{ background: d ? '#1A1A1A' : '#F5F0E8', border: `1px solid ${border}` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden">
                    <img src="/beeyes-design/images/financas.png" alt="Finanças" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: textSub }}>Resumo Semanal</p>
                    <p className="font-semibold text-sm" style={{ color: text }}>Finanças Pessoais</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: textSub }} />
              </div>
            </div>
          </div>

          {/* User message */}
          <div className="flex items-start gap-4 max-w-[80%] self-end flex-row-reverse">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1 ring-2 ring-[#F5A623]">
              <img src="https://ui-avatars.com/api/?name=Alex&background=F5A623&color=fff" alt="User" className="w-full h-full object-cover" />
            </div>
            <div className="beeyes-gradient-bg text-[#1A1A1A] rounded-2xl rounded-tr-none px-5 py-3.5 text-sm leading-relaxed shadow-lg font-medium">
              <p>Isso é ótimo! Pode me lembrar de pagar a conta de luz amanhã às 10h?</p>
            </div>
          </div>

          {/* Bee message */}
          <div className="flex items-start gap-4 max-w-[80%]">
            <img src="/beeyes-design/images/bee-icon.png" alt="Bee" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-1 shadow" />
            <div
              className="rounded-2xl rounded-tl-none px-5 py-3.5 text-sm leading-relaxed shadow-lg"
              style={{ background: d ? '#2D2D2D' : '#FFFFFF', border: `1px solid ${border}`, color: text }}
            >
              <p>Claro! Lembrete adicionado para amanhã às 10h: <strong>Pagar conta de luz</strong>. 🍯</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div
          className={`p-6 z-10 ${d ? 'beeyes-glass' : 'beeyes-glass-light'}`}
        >
          <div
            className="flex items-center gap-3 rounded-full p-2 pl-4 transition-colors"
            style={{ background: inputBg, border: `1px solid ${border}` }}
          >
            <button style={{ color: textSub }}>
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              type="text"
              placeholder="Fale com sua Bee..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              style={{ color: text }}
            />
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: d ? 'rgba(45,45,45,0.8)' : 'rgba(245,166,35,0.12)', color: textSub }}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full beeyes-gradient-bg flex items-center justify-center text-[#1A1A1A] beeyes-glow">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        className={`w-[380px] flex flex-col ${d ? 'beeyes-glass' : 'beeyes-glass-light'}`}
        style={{ background: d ? 'rgba(26,26,26,0.9)' : 'rgba(250,250,245,0.9)' }}
      >
        {/* Tabs */}
        <div
          className="flex px-4 pt-6 pb-0 overflow-x-auto beeyes-scrollbar"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          {['Feed', 'Colmeia', 'Amigos', 'Mensagens', 'Comunidades'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-3 whitespace-nowrap text-sm font-medium transition-all border-b-2"
              style={{
                borderBottomColor: activeTab === tab ? '#F5A623' : 'transparent',
                color: activeTab === tab ? '#F5A623' : textSub,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 beeyes-scrollbar">

          {activeTab === 'Colmeia' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold" style={{ color: text }}>Sua Colmeia</h3>
                <button className="text-xs text-[#F5A623] hover:underline">Editar</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {COLMEIA_TOOLS.map((tool, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer ${d ? 'beeyes-tool-card-dark' : 'beeyes-tool-card-light'}`}
                  >
                    <div className="w-16 h-16 flex items-center justify-center">
                      {tool.img ? (
                        <img src={tool.img} alt={tool.label} className="w-full h-full object-contain drop-shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: d ? 'rgba(147,51,234,0.15)' : 'rgba(147,51,234,0.1)' }}>
                          <Hash className="w-7 h-7 text-purple-400" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: d ? '#D1D5DB' : '#374151' }}>{tool.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Amigos' && (
            <div>
              <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textSub }} />
                <input
                  type="text"
                  placeholder="Buscar amigos..."
                  className="w-full rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none transition-all"
                  style={{ background: d ? '#2D2D2D' : '#F0EDE5', border: `1px solid ${border}`, color: text }}
                />
              </div>
              <div className="flex flex-col gap-1">
                {['Sarah Oliveira', 'Lucas Costa', 'Mariana Silva', 'João Pedro'].map((name, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ color: text }}
                    onMouseEnter={e => (e.currentTarget.style.background = d ? 'rgba(45,45,45,0.8)' : 'rgba(245,166,35,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <img src={`https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random&color=fff`} alt={name} className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${idx % 2 === 0 ? 'bg-green-500' : 'bg-gray-500'}`} style={{ borderColor: bg }}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{name}</p>
                      <p className="text-xs truncate" style={{ color: textSub }}>Membro</p>
                    </div>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ color: textSub }}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Feed' && (
            <div className="flex flex-col gap-5">
              {[1, 2].map(post => (
                <div key={post} className="rounded-2xl p-4" style={{ background: d ? 'rgba(45,45,45,0.4)' : '#FFFFFF', border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <img src={`https://ui-avatars.com/api/?name=User+${post}&background=random&color=fff`} alt="User" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: text }}>Usuário {post}</p>
                      <p className="text-xs" style={{ color: textSub }}>Há 2 horas</p>
                    </div>
                  </div>
                  <p className="text-sm mb-4" style={{ color: d ? '#D1D5DB' : '#4B5563' }}>
                    Acabei de configurar minha Bee para gerenciar meus investimentos. O nível de detalhe é incrível! 🐝✨
                  </p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: textSub }}>
                    <button className="flex items-center gap-1.5 hover:text-[#F5A623] transition-colors">
                      <Heart className="w-4 h-4" /> 24
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#F5A623] transition-colors">
                      <MessageSquare className="w-4 h-4" /> 5
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Mensagens' && (
            <div className="flex flex-col gap-2">
              {['Sarah Oliveira', 'Lucas Costa', 'Mariana Silva'].map((name, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = d ? 'rgba(45,45,45,0.8)' : 'rgba(245,166,35,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img src={`https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random&color=fff`} alt={name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: text }}>{name}</p>
                    <p className="text-xs truncate" style={{ color: textSub }}>Você: Fala chefe</p>
                  </div>
                  <span className="text-xs" style={{ color: textSub }}>2d</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Comunidades' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: text }}>Comunidades</h3>
                <button className="flex items-center gap-1 text-xs beeyes-gradient-bg text-[#1A1A1A] px-3 py-1.5 rounded-full font-semibold">
                  <Plus className="w-3 h-3" /> Criar
                </button>
              </div>
              {['Finanças Pessoais', 'IA & Tecnologia', 'Produtividade'].map((c, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl mb-2 cursor-pointer transition-colors"
                  style={{ background: d ? 'rgba(45,45,45,0.4)' : '#FFFFFF', border: `1px solid ${border}` }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden beeyes-gradient-bg flex items-center justify-center">
                    <Hash className="w-4 h-4 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: text }}>{c}</p>
                    <p className="text-xs" style={{ color: textSub }}>{(idx + 1) * 124} membros</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
