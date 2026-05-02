// Seeds localStorage with demo data for the given uid.
// Called right before onLogin() so MainApp initializes with pre-populated state.
export function seedDemo(uid) {
  const k = (key) => `mf2_${uid}_${key}`;
  const save = (key, val) => localStorage.setItem(k(key), JSON.stringify(val));

  // ── Accounts ─────────────────────────────────────────────────
  save('accounts', [
    { id:'acc1', name:'Nubank',          type:'corrente',    color:'#a78bfa', initialBalance:4820.50 },
    { id:'acc2', name:'Caixa Poupança',  type:'poupanca',    color:'#4ade80', initialBalance:12400.00 },
    { id:'acc3', name:'XP Investimentos',type:'investimento', color:'#facc15', initialBalance:47300.00 },
  ]);

  // ── Goals ────────────────────────────────────────────────────
  save('goals', {
    monthly: 8000,
    savingsPct: 20,
    reservaMeta: 35000,
    reservaAtual: 12400,
    savingsGoals: [
      { id:'g1', name:'Viagem Europa', targetAmount:18000, targetMonth:'2027-06', currentAmount:4200 },
      { id:'g2', name:'Notebook novo', targetAmount:6500,  targetMonth:'2026-12', currentAmount:2100 },
    ],
  });

  // ── Budgets (some near limit, some exceeded — shows alerts) ──
  save('budgets', {
    alimentacao: 900,
    moradia:     2300,
    transporte:  400,
    lazer:       350,
    saude:       700,
    assinatura:  220,
    educacao:    500,
  });

  // ── Dividas ──────────────────────────────────────────────────
  save('dividas', [
    {
      id:'div1', name:'Financiamento Carro',
      totalAmount:36000, installments:60, startMonth:'2023-06',
      category:'transporte', notes:'Honda Civic — Itaú Financiamentos',
      paidMonths:{},
    },
    {
      id:'div2', name:'Empréstimo Pessoal',
      totalAmount:12000, installments:24, startMonth:'2024-06',
      category:'divida', notes:'CEF — taxa 1,8% a.m.',
      paidMonths:{},
    },
  ]);

  // ── Cards ────────────────────────────────────────────────────
  save('cards', [
    { id:'c1', name:'Nubank Roxinho', color:'#a78bfa', closeDay:3,  dueDay:10,  limit:5000 },
    { id:'c2', name:'Itaú Platinum',  color:'#60a5fa', closeDay:15, dueDay:22,  limit:8000 },
  ]);

  // ── Card purchases ───────────────────────────────────────────
  save('cpurchases', [
    { id:'cp1',  cardId:'c1', description:'iFood Jantar',           amount:87.90,  date:'2026-05-07', category:'alimentacao' },
    { id:'cp2',  cardId:'c1', description:'Amazon — Livros',        amount:134.70, date:'2026-05-04', category:'educacao'    },
    { id:'cp3',  cardId:'c1', description:'Zara — Calça jeans',     amount:299.90, date:'2026-04-22', category:'outro'       },
    { id:'cp4',  cardId:'c1', description:'iFood Almoço',           amount:45.50,  date:'2026-04-17', category:'alimentacao' },
    { id:'cp5',  cardId:'c1', description:'Netflix',                amount:55.90,  date:'2026-04-18', category:'assinatura'  },
    { id:'cp6',  cardId:'c2', description:'Supermercado Carrefour', amount:487.30, date:'2026-05-08', category:'alimentacao' },
    { id:'cp7',  cardId:'c2', description:'Posto Ipiranga',         amount:195.00, date:'2026-05-06', category:'transporte'  },
    { id:'cp8',  cardId:'c2', description:'Drogasil',               amount:98.40,  date:'2026-05-09', category:'saude'       },
    { id:'cp9',  cardId:'c2', description:'Renner — Camisetas',     amount:189.90, date:'2026-04-12', category:'outro'       },
    { id:'cp10', cardId:'c2', description:'Burger King',            amount:62.50,  date:'2026-04-28', category:'alimentacao' },
  ]);

  // ── Card faturas (April paid) ─────────────────────────────────
  save('cfaturas', {
    'c1_2026-04': { paid:true, paidAt:'2026-04-10T10:00:00Z' },
    'c2_2026-04': { paid:true, paidAt:'2026-04-22T10:00:00Z' },
  });

  // ── Entries ───────────────────────────────────────────────────
  const SBM = (months) => Object.fromEntries(months.map(m=>[m,{status:'pago'}]));
  const paid6 = SBM(['2025-11','2025-12','2026-01','2026-02','2026-03','2026-04']);
  const paid5 = SBM(['2025-11','2025-12','2026-01','2026-02','2026-03']);

  save('entries', [
    // ── Receitas ──
    {
      id:'e01', description:'Salário CLT', type:'receita',
      amount:6800, date:'2024-01-05', category:'salario',
      recurrence:'monthly', status:'pago', notes:'Empresa Tecnologia Ltda',
      tags:['salário'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e02', description:'Dividendos FII MXRF11', type:'receita',
      amount:390, date:'2025-01-20', category:'investimento',
      recurrence:'monthly', status:'pago', notes:'',
      tags:[], statusByMonth:{},
      overrides:{'2026-03':{amount:420},'2026-04':{amount:415},'2026-05':{amount:435}},
      accountId:'acc3',
    },
    {
      id:'e03', description:'Freelance — App Mobile', type:'receita',
      amount:3500, date:'2026-04-28', category:'freelance',
      recurrence:'none', status:'pago', notes:'Cliente Startup Y — sistema de agendamento',
      tags:['extra','tech'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e04', description:'Freelance — Landing Page', type:'receita',
      amount:1800, date:'2026-02-15', category:'freelance',
      recurrence:'none', status:'pago', notes:'',
      tags:['extra'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e05', description:'Reembolso plano saúde', type:'receita',
      amount:280, date:'2026-05-08', category:'saude',
      recurrence:'none', status:'pago', notes:'Consulta cardiologista',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Despesas fixas mensais ──
    {
      id:'e10', description:'Aluguel', type:'despesa',
      amount:1850, date:'2024-01-05', category:'moradia',
      recurrence:'monthly', status:'a_pagar', notes:'Vencimento todo dia 5',
      tags:[], statusByMonth:paid6, overrides:{}, accountId:'acc1',
    },
    {
      id:'e11', description:'Condomínio', type:'despesa',
      amount:380, date:'2024-01-10', category:'moradia',
      recurrence:'monthly', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e12', description:'Internet Vivo Fibra', type:'despesa',
      amount:119.90, date:'2024-01-15', category:'assinatura',
      recurrence:'monthly', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e13', description:'Netflix', type:'despesa',
      amount:55.90, date:'2024-01-18', category:'assinatura',
      recurrence:'monthly', status:'pago', notes:'',
      tags:['streaming'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e14', description:'Spotify Premium', type:'despesa',
      amount:21.90, date:'2024-01-18', category:'assinatura',
      recurrence:'monthly', status:'pago', notes:'',
      tags:['streaming'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e15', description:'Academia Smart Fit', type:'despesa',
      amount:99.90, date:'2024-01-20', category:'saude',
      recurrence:'monthly', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e16', description:'Plano de saúde Unimed', type:'despesa',
      amount:498, date:'2024-01-25', category:'saude',
      recurrence:'monthly', status:'pago', notes:'Família — 2 dependentes',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e17', description:'Seguro Auto', type:'despesa',
      amount:210, date:'2024-01-28', category:'transporte',
      recurrence:'monthly', status:'pago', notes:'Porto Seguro',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Parcelados (installments) ──
    {
      id:'e20', description:'iPhone 16 Pro', type:'despesa',
      amount:9600, date:'2025-09-10', category:'outro',
      recurrence:'installment', installments:12, status:'a_pagar',
      notes:'Magazine Luiza 12x sem juros',
      tags:['tech'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e21', description:'Geladeira Brastemp', type:'despesa',
      amount:3600, date:'2026-01-15', category:'moradia',
      recurrence:'installment', installments:6, status:'pago',
      notes:'Fast Shop 6x',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e22', description:'Curso Full Stack', type:'despesa',
      amount:2490, date:'2026-03-01', category:'educacao',
      recurrence:'installment', installments:3, status:'pago',
      notes:'Rocketseat Ignite',
      tags:['educação','tech'], statusByMonth:{}, overrides:{}, accountId:null,
    },

    // ── Maio 2026 (mês atual) ──
    {
      id:'e30', description:'Mercado — Compra semanal', type:'despesa',
      amount:312.50, date:'2026-05-03', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e31', description:'Mercado — Compra semanal', type:'despesa',
      amount:298.80, date:'2026-05-10', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e32', description:'Restaurante Outback', type:'despesa',
      amount:245, date:'2026-05-15', category:'alimentacao',
      recurrence:'none', status:'a_pagar', notes:'Aniversário da Ana',
      tags:['restaurante'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e33', description:'Uber — corridas', type:'despesa',
      amount:94.70, date:'2026-05-09', category:'transporte',
      recurrence:'none', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e34', description:'Combustível', type:'despesa',
      amount:280, date:'2026-05-05', category:'transporte',
      recurrence:'none', status:'pago', notes:'Tanque cheio',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e35', description:'Farmácia — Medicamentos', type:'despesa',
      amount:142.30, date:'2026-05-06', category:'saude',
      recurrence:'none', status:'pago', notes:'Pressão + vitaminas',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e36', description:'Cinema — Missão Impossível 8', type:'despesa',
      amount:88, date:'2026-05-11', category:'lazer',
      recurrence:'none', status:'pago', notes:'2 ingressos + pipoca',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e37', description:'Show Coldplay', type:'despesa',
      amount:380, date:'2026-05-17', category:'lazer',
      recurrence:'none', status:'a_pagar', notes:'2 ingressos — Allianz Parque',
      tags:['evento'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e38', description:'Curso Python — Udemy', type:'despesa',
      amount:79.90, date:'2026-05-02', category:'educacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['educação'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e39', description:'Veterinário — Consulta + vacinas', type:'despesa',
      amount:310, date:'2026-05-13', category:'saude',
      recurrence:'none', status:'pago', notes:'Pet Shop Americanas',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },

    // ── Abril 2026 ──
    {
      id:'e40', description:'Mercado Pão de Açúcar', type:'despesa',
      amount:534.20, date:'2026-04-04', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e41', description:'Passagem SP → Floripa', type:'despesa',
      amount:420, date:'2026-04-18', category:'lazer',
      recurrence:'none', status:'pago', notes:'GOL ida e volta',
      tags:['viagem'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e42', description:'Hotel Majestic Florianópolis', type:'despesa',
      amount:960, date:'2026-04-19', category:'lazer',
      recurrence:'none', status:'pago', notes:'4 noites',
      tags:['viagem'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e43', description:'Combustível', type:'despesa',
      amount:265, date:'2026-04-06', category:'transporte',
      recurrence:'none', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Março 2026 ──
    {
      id:'e50', description:'Mercado', type:'despesa',
      amount:618.40, date:'2026-03-03', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e51', description:'Restaurante Japonês', type:'despesa',
      amount:187, date:'2026-03-22', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['restaurante'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e52', description:'Dentista — Limpeza', type:'despesa',
      amount:250, date:'2026-03-15', category:'saude',
      recurrence:'none', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e53', description:'Freelance — Sistema Web', type:'receita',
      amount:2200, date:'2026-03-28', category:'freelance',
      recurrence:'none', status:'pago', notes:'',
      tags:['extra'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Fevereiro 2026 ──
    {
      id:'e60', description:'Mercado', type:'despesa',
      amount:490.80, date:'2026-02-06', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e61', description:'Ingresso Hopi Hari', type:'despesa',
      amount:280, date:'2026-02-14', category:'lazer',
      recurrence:'none', status:'pago', notes:'2 pessoas — Dia dos Namorados',
      tags:[], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e62', description:'IPTU — 1ª parcela', type:'despesa',
      amount:420, date:'2026-02-10', category:'moradia',
      recurrence:'none', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Janeiro 2026 ──
    {
      id:'e70', description:'Mercado', type:'despesa',
      amount:710, date:'2026-01-04', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'Compra de mês + itens de limpeza',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e71', description:'IPVA Carro', type:'despesa',
      amount:1840, date:'2026-01-20', category:'transporte',
      recurrence:'none', status:'pago', notes:'Honda Civic 2022',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },

    // ── Novembro + Dezembro 2025 ──
    {
      id:'e80', description:'Mercado', type:'despesa',
      amount:680, date:'2025-12-03', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e81', description:'Presentes de Natal', type:'despesa',
      amount:850, date:'2025-12-20', category:'lazer',
      recurrence:'none', status:'pago', notes:'Família',
      tags:['natal'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e82', description:'Ceia de Natal', type:'despesa',
      amount:380, date:'2025-12-24', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['natal'], statusByMonth:{}, overrides:{}, accountId:null,
    },
    {
      id:'e83', description:'13º Salário', type:'receita',
      amount:6800, date:'2025-12-05', category:'salario',
      recurrence:'none', status:'pago', notes:'',
      tags:[], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
    {
      id:'e84', description:'Mercado', type:'despesa',
      amount:595, date:'2025-11-05', category:'alimentacao',
      recurrence:'none', status:'pago', notes:'',
      tags:['mercado'], statusByMonth:{}, overrides:{}, accountId:'acc1',
    },
  ]);

  // ── Mark onboarding as done ───────────────────────────────────
  save('onboarding_done', true);
}
