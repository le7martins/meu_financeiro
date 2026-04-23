import { useState } from 'react';

const STEPS = [
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
        <line x1="6" y1="15" x2="10" y2="15"/>
        <line x1="14" y1="15" x2="16" y2="15"/>
      </svg>
    ),
    color: '#4ade80',
    bg: 'rgba(74,222,128,.08)',
    border: 'rgba(74,222,128,.2)',
    title: 'Bem-vindo ao CashUp!',
    subtitle: 'Seu controle financeiro pessoal',
    desc: 'Registre receitas e despesas, acompanhe seu saldo e tenha uma visão clara de onde seu dinheiro vai — tudo de forma simples e rápida.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
    color: '#8ab4f8',
    bg: 'rgba(138,180,248,.08)',
    border: 'rgba(138,180,248,.2)',
    title: 'Lance receitas e despesas',
    subtitle: 'Toque no botão + para começar',
    desc: 'Adicione lançamentos únicos ou recorrentes (fixo, semanal, quinzenal, parcelado). Categorize tudo para entender seus gastos.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    color: '#a78bfa',
    bg: 'rgba(167,139,250,.08)',
    border: 'rgba(167,139,250,.2)',
    title: 'Análise e gráficos',
    subtitle: 'Entenda seus padrões financeiros',
    desc: 'Visualize barras, evolução e pizza por categoria. Compare meses, veja projeções e acompanhe faturas de cartão de crédito.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
    color: '#facc15',
    bg: 'rgba(250,204,21,.08)',
    border: 'rgba(250,204,21,.2)',
    title: 'Saúde Financeira',
    subtitle: 'Score e metas personalizadas',
    desc: 'Acompanhe seu score de saúde financeira, defina metas de renda e poupança, monitore reserva de emergência e budget por categoria.',
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: '#4ade80',
    bg: 'rgba(74,222,128,.08)',
    border: 'rgba(74,222,128,.2)',
    title: 'Dados seguros na nuvem',
    subtitle: 'Sincronização automática',
    desc: 'Seus dados ficam salvos em tempo real na nuvem Firebase. Acesse de qualquer dispositivo com sua conta. Nenhum dado é perdido.',
  },
];

export default function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #080c12)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px 40px',
      fontFamily: "'DM Sans', sans-serif",
      color: 'var(--text1, #fff)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes onboardIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .onboard-step { animation: onboardIn .35s cubic-bezier(.22,1,.36,1); }
        .onboard-next { transition: transform .15s, box-shadow .15s; }
        .onboard-next:hover { transform: scale(1.03); }
        .onboard-next:active { transform: scale(0.97); }
        .onboard-skip { transition: color .2s; }
        .onboard-skip:hover { color: var(--text3, #556) !important; }
      `}</style>

      {/* Skip button */}
      <button
        className="onboard-skip"
        onClick={onDone}
        style={{
          position: 'fixed', top: 20, right: 20,
          background: 'none', border: 'none',
          color: 'var(--text4, #334)', fontSize: 13,
          fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', padding: '6px 10px',
        }}>
        Pular
      </button>

      {/* Content */}
      <div key={step} className="onboard-step" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', maxWidth: 360, width: '100%', flex: 1,
        justifyContent: 'center', gap: 0,
      }}>
        {/* Icon circle */}
        <div style={{
          width: 110, height: 110, borderRadius: 30,
          background: s.bg, border: `1.5px solid ${s.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, boxShadow: `0 0 40px ${s.color}18`,
        }}>
          {s.icon}
        </div>

        {/* Title */}
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.5px' }}>
          {s.title}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginBottom: 16, letterSpacing: '0.02em' }}>
          {s.subtitle}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 14, color: 'var(--text3, #778)',
          lineHeight: 1.65, maxWidth: 300,
        }}>
          {s.desc}
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            style={{
              width: i === step ? 22 : 7,
              height: 7,
              borderRadius: 4,
              background: i === step ? s.color : 'rgba(255,255,255,.15)',
              border: 'none', cursor: 'pointer',
              transition: 'width .25s, background .25s',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* CTA Button */}
      <button
        className="onboard-next"
        onClick={() => isLast ? onDone() : setStep(p => p + 1)}
        style={{
          width: '100%', maxWidth: 360,
          padding: '15px',
          background: `linear-gradient(135deg, ${s.color}33, ${s.color}18)`,
          border: `1.5px solid ${s.color}55`,
          color: s.color,
          borderRadius: 14, fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: `0 4px 20px ${s.color}18`,
        }}>
        {isLast ? '🚀 Começar agora' : 'Próximo →'}
      </button>
    </div>
  );
}
