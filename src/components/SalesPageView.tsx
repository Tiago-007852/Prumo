/**
 * Página de vendas pública (/vendas) — feita para receber tráfego externo
 * (anúncios, WhatsApp, links) e converter em conta.
 *
 * Decisões combinadas com o pedido:
 *  - SEM depoimentos (só prova factual: empresas, países, offline);
 *  - DOIS cartões de preço lado a lado (Brasil: cartão · Angola: código);
 *  - público Brasil e Angola na mesma página.
 *
 * Visual: herda o "liquid glass" da landing porque a raiz leva as duas classes
 * (`.prumo-landing` dá tokens, tema escuro, orbes, tipografia e componentes como
 * .glass/.btn/.proof/.phone; `.sv-*` são os blocos novos, só neste ficheiro).
 * Nada de pagamento/auth é reimplementado: os CTAs levam à landing normal,
 * que já liga cadastro, login e Google.
 */
import React, { useEffect, useState } from 'react';
import '../styles/sales-page.css';
import {
  ArrowRight,
  Wallet,
  CalendarClock,
  Target,
  MessageSquare,
  Repeat,
  FileText,
  Globe2,
  WifiOff,
  Check,
} from 'lucide-react';
import {
  LANDING_PREVIEW,
  LANDING_PREVIEW_ORDER,
  LANDING_SOCIAL_LOGOS,
  type LandingCountry,
} from '../config/landing';
import { PRICING_AO, PRICING_BR } from '../config/pricing';
import { MODULES, BONUSES, formatPrice } from './SalesFunnelView';
import { PrumoMark, LogoMark } from './LandingView';

const PAINS = [
  {
    icon: Wallet,
    title: 'No fim do mês, sobra dúvida',
    text: 'Lance cada gasto em segundos e veja para onde o dinheiro foi — sem esperar a fatura fechar para descobrir.',
  },
  {
    icon: CalendarClock,
    title: 'Despesas que sempre esquecem',
    text: 'Aluguel, contas e assinaturas entram sozinhos como recorrências, com alerta antes de estourar o limite.',
  },
  {
    icon: Target,
    title: 'Metas que ficam só na intenção',
    text: 'Orçamento por categoria e projeção de 24 meses mostram quanto falta, quanto sobra e quando a meta chega.',
  },
];

const FAQ = [
  {
    q: 'Funciona mesmo sem internet?',
    a: 'Sim. O Prumo é offline-first: os dados ficam no seu aparelho e sincronizam quando a conexão volta — no celular, no computador, tanto faz.',
  },
  {
    q: 'Onde ficam os meus dados financeiros?',
    a: 'No seu aparelho e numa conta criptografada. Pode exportar tudo ou apagar a conta quando quiser, conforme a LGPD.',
  },
  {
    q: 'Preciso pagar alguma coisa para começar?',
    a: 'Criar a conta é grátis e não pede cartão. O acesso completo é mensal e pode ser cancelado a qualquer momento, sem multa.',
  },
  {
    q: 'Em Angola, como é feito o pagamento?',
    a: 'O acesso angolano é ativado por código de 31 dias: depois de criar a conta, é só colar o código no funil de ativação.',
  },
  {
    q: 'Posso entrar com a conta do Google?',
    a: 'Sim, em um clique. Se você já tem cadastro por e-mail, o Google entra na mesma conta.',
  },
  {
    q: 'Serve para quem tem conta em vários bancos?',
    a: 'Sim: lance contas de vários bancos, importe extratos em OFX e veja o saldo agregado — com Open Finance onde houver suporte.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. É um aplicativo web que você pode instalar na tela inicial do celular (PWA) e continuar usando offline.',
  },
];

function goto(url: string) {
  window.location.assign(url);
}

export const SalesPageView: React.FC = () => {
  const [previewCountry, setPreviewCountry] = useState<LandingCountry>('BR');
  const d = LANDING_PREVIEW[previewCountry];

  // Título próprio para os anúncios (as meta tags OG continuam as de index.html).
  useEffect(() => {
    const previous = document.title;
    document.title = 'Prumo — copiloto financeiro que funciona offline | Brasil e Angola';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="prumo-landing sv-page">
      <div className="bg" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="grid" />
      </div>

      <main className="sv-wrap">
        {/* ── Cabeçalho ── */}
        <div className="top">
          <div className="brand">
            <div className="logo">
              <PrumoMark s={26} />
            </div>
            <div>
              <b>Prumo</b>
              <small>Copiloto financeiro para Brasil e Angola</small>
            </div>
          </div>
          <div className="glass pill" style={{ borderRadius: 99 }}>
            <i />
            beta público
          </div>
        </div>

        {/* ── 1. Hero ── */}
        <section className="sv-hero sv-sect">
          <p className="sv-eyebrow">Orçamentos · metas · copiloto de IA</p>
          <h1>
            Seu dinheiro de volta ao <em>prumo</em>.
          </h1>
          <p className="lead">
            Lançamentos, orçamentos, metas e um copiloto de IA que conhece as suas contas.{' '}
            <b>Funciona sem internet</b> e sincroniza quando a conexão volta.
          </p>
          <div className="sv-ctas">
            <button type="button" className="btn" onClick={() => goto('/')}>
              Criar conta grátis
              <ArrowRight size={17} />
            </button>
            <button type="button" className="sv-ghost" onClick={() => goto('/?modo=entrar')}>
              Já tenho conta — entrar
            </button>
          </div>
          <p className="sv-micro">Criar a conta é grátis · sem cartão para começar · cancele quando quiser</p>
        </section>

        {/* ── 2. Prova factual (sem depoimentos) ── */}
        <section className="sv-sect" aria-label="Prova social">
          <div className="glass proof">
            <div className="avs" aria-hidden="true">
              {LANDING_SOCIAL_LOGOS.map((logo) =>
                logo.src ? (
                  <i key={logo.name ?? logo.mark} className="has-logo" title={logo.name}>
                    <img src={logo.src} alt="" loading="lazy" decoding="async" width={32} height={32} />
                  </i>
                ) : (
                  <i key={logo.mark} title={logo.name}>
                    <LogoMark mark={logo.mark} />
                  </i>
                )
              )}
            </div>
            <div className="ptxt">
              <strong>17 empresas</strong>
              <span>já usam o Prumo no dia a dia</span>
            </div>
            <div className="pc">
              <div>
                <b>12</b>🇦🇴 Angola
              </div>
              <div>
                <b>5</b>🇧🇷 Brasil
              </div>
            </div>
          </div>

          <div className="sv-grid3">
            <div className="glass sv-item">
              <div className="sv-ico">
                <WifiOff size={20} />
              </div>
              <h3>100% offline-first</h3>
              <p>Registre e consulte sem internet; quando a conexão volta, tudo sincroniza sozinho.</p>
            </div>
            <div className="glass sv-item">
              <div className="sv-ico">
                <Globe2 size={20} />
              </div>
              <h3>Brasil e Angola no mesmo app</h3>
              <p>R$ e Kz com dados separados por país e conteúdo no idioma certo para cada um.</p>
            </div>
            <div className="glass sv-item">
              <div className="sv-ico">
                <MessageSquare size={20} />
              </div>
              <h3>Copiloto de IA que fala a sua língua</h3>
              <p>Pergunte por texto ou voz e receba respostas com base nas suas contas reais.</p>
            </div>
          </div>
        </section>

        {/* ── 3. O problema ── */}
        <section className="sv-sect">
          <p className="sv-eyebrow">Por que existe o Prumo</p>
          <h2 className="sv-h2">
            O dinheiro some em detalhes <em>que ninguém mostra</em>.
          </h2>
          <p className="sv-sub">
            Planilha não avisa, aplicativo do banco só mostra o saldo. O Prumo transforma cada lançamento em
            decisão — no dia em que acontece.
          </p>
          <div className="sv-grid3">
            {PAINS.map((p) => (
              <div className="glass sv-item" key={p.title}>
                <div className="sv-ico">
                  <p.icon size={20} />
                </div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. O que está incluído ── */}
        <section className="sv-sect">
          <p className="sv-eyebrow">Tudo incluído</p>
          <h2 className="sv-h2">Um só aplicativo para as seis frentes que bagunçam a vida financeira</h2>
          <div className="sv-list">
            {MODULES.map((m) => (
              <div className="sv-mod" key={m.title}>
                <span className="sv-tag">{m.tag}</span>
                <div>
                  <b>{m.title}</b>
                  <span>{m.pain}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="sv-bonus">
            {BONUSES.map((b) => (
              <div className="sv-mod" key={b.title}>
                <span className="sv-tag">{b.tag}</span>
                <div>
                  <b>{b.title}</b>
                  <span>{b.pain}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Demonstração ── */}
        <section className="sv-sect sv-demo">
          <p className="sv-eyebrow">Como é na prática</p>
          <h2 className="sv-h2">O seu panorama do mês, aberto em segundos</h2>
          <div className="stage">
            <div className="phonecol">
              <div className="glass cur" role="group" aria-label="Moeda do exemplo">
                {LANDING_PREVIEW_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={previewCountry === k}
                    onClick={() => setPreviewCountry(k)}
                  >
                    {LANDING_PREVIEW[k].flag} {LANDING_PREVIEW[k].cur}
                  </button>
                ))}
              </div>

              <div className="glass phone" aria-label="Pré-visualização do app">
                <div className="screen">
                  <div key={previewCountry} className="swap">
                    <div className="sh">
                      <span>Saldo projetado</span>
                      <span>12 meses</span>
                    </div>
                    <div className="bal">{d.bal}</div>
                    <div className="up">{d.up}</div>
                    <svg className="chart" viewBox="0 0 220 92" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="svpg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#e3b93c" stopOpacity=".45" />
                          <stop offset="1" stopColor="#e3b93c" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 74 C25 70 35 52 60 56 S100 68 125 40 S180 24 220 10 V92 H0Z"
                        fill="url(#svpg)"
                      />
                      <path
                        d="M0 74 C25 70 35 52 60 56 S100 68 125 40 S180 24 220 10"
                        fill="none"
                        stroke="#f6dc8a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="220" cy="10" r="4" fill="#f6dc8a" />
                    </svg>
                    <div className="mini">
                      <div>
                        Gastos<b>{d.gastos}</b>
                      </div>
                      <div>
                        {d.meta[0]}
                        <b>{d.meta[1]}</b>
                      </div>
                    </div>
                    <div className="ask">{d.ask}</div>
                    <div className="chat">
                      <span>Copiloto Prumo</span>
                      {d.reply}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat">
              <div className="glass card">
                <div className="ico">
                  <Repeat size={20} />
                </div>
                <h3>Recorrências e parcelas automáticas</h3>
                <p>Aluguel, salário e assinaturas lançam sozinhos. Parcelas aparecem mês a mês.</p>
              </div>
              <div className="glass card">
                <div className="ico">
                  <FileText size={20} />
                </div>
                <h3>Extrato OFX e relatório em PDF</h3>
                <p>Importe o extrato do banco em segundos e gere o relatório mensal pronto para guardar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Preço: dois cartões lado a lado ── */}
        <section className="sv-sect">
          <p className="sv-eyebrow">Preço</p>
          <h2 className="sv-h2">Um plano, dois países — você paga do seu jeito</h2>
          <p className="sv-sub">Mesmo valor convertido nos dois mercados, sem surpresa na fatura.</p>

          <div className="sv-prices">
            {/* Brasil */}
            <div className="sv-price">
              <span className="sv-badge">Cartão · mensal</span>
              <div className="sv-flag">🇧🇷 Brasil — em reais</div>
              <div className="sv-anchor">{formatPrice(PRICING_BR.anchor, 'BRL')}</div>
              <div className="sv-amount">{formatPrice(PRICING_BR.monthly, 'BRL')}</div>
              <div className="sv-per">{PRICING_BR.perDayLabel}</div>
              <div className="sv-bill">{PRICING_BR.billingNote}</div>
              <ul>
                <li>
                  <Check size={16} /> Assinatura mensal no cartão, sem fidelidade
                </li>
                <li>
                  <Check size={16} /> Acesso imediato a todos os módulos
                </li>
                <li>
                  <Check size={16} /> Cancela quando quiser, direto no aplicativo
                </li>
              </ul>
              <button type="button" className="btn" onClick={() => goto('/')}>
                Criar conta e assinar
              </button>
            </div>

            {/* Angola */}
            <div className="sv-price">
              <span className="sv-badge">Código · 31 dias</span>
              <div className="sv-flag">🇦🇴 Angola — em kwanzas</div>
              <div className="sv-anchor">{formatPrice(PRICING_AO.anchor, 'AOA')}</div>
              <div className="sv-amount">{formatPrice(PRICING_AO.monthly, 'AOA')}</div>
              <div className="sv-per">{PRICING_AO.perDayLabel}</div>
              <div className="sv-bill">{PRICING_AO.billingNote}</div>
              <ul>
                <li>
                  <Check size={16} /> Ativação por código de 31 dias
                </li>
                <li>
                  <Check size={16} /> Pagamento combinado no atendimento
                </li>
                <li>
                  <Check size={16} /> Depois é só colar o código na conta
                </li>
              </ul>
              <button type="button" className="btn" onClick={() => goto('/')}>
                Criar conta e ativar
              </button>
            </div>
          </div>

          <p className="sv-note">
            4.900 Kz ≈ R$ 29,90 por mês. Cobrança recorrente apenas no Brasil; em Angola, um código por mês.
          </p>
        </section>

        {/* ── 7. FAQ ── */}
        <section className="sv-sect">
          <p className="sv-eyebrow">Perguntas frequentes</p>
          <h2 className="sv-h2">Antes de começar</h2>
          <div className="sv-faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── 8. CTA final ── */}
        <section className="glass sv-final sv-sect">
          <p className="sv-eyebrow">Comece agora</p>
          <h2 className="sv-h2">
            Um minuto para organizar <em>os próximos doze meses</em>.
          </h2>
          <p className="sv-sub">
            Crie a conta, responda ao questionário rápido e veja o seu panorama montado — em R$ ou Kz, com ou sem
            internet.
          </p>
          <div className="sv-ctas">
            <button type="button" className="btn" onClick={() => goto('/')}>
              Criar conta grátis
              <ArrowRight size={17} />
            </button>
            <button type="button" className="sv-ghost" onClick={() => goto('/?modo=entrar')}>
              Entrar com uma conta existente
            </button>
          </div>
        </section>

        <footer className="sv-foot">
          <span>Prumo © 2026 · Sessão segura · Conforme a LGPD</span>
          <span>Brasil 🇧🇷 · Angola 🇦🇴</span>
        </footer>
      </main>

      {/* Barra fixa de CTA no telemóvel */}
      <div className="sv-bar">
        <div>
          <b>{formatPrice(PRICING_BR.monthly, 'BRL')} ou {formatPrice(PRICING_AO.monthly, 'AOA')}</b>
          <span>por mês · cancele quando quiser</span>
        </div>
        <button type="button" className="btn" onClick={() => goto('/')}>
          Começar
        </button>
      </div>
    </div>
  );
};

export default SalesPageView;
