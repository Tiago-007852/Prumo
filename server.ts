import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Carregar o prompt de sistema configurado
let systemPromptTemplate = '';
try {
  const promptPath = path.join(process.cwd(), 'prompts', 'copiloto-system.md');
  if (fs.existsSync(promptPath)) {
    systemPromptTemplate = fs.readFileSync(promptPath, 'utf-8');
  }
} catch (err) {
  console.warn('Não foi possível ler prompts/copiloto-system.md:', err);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Prumo',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Endpoint do Copiloto Financeiro com IA (Seção 5 do Brief)
app.post('/api/copiloto', async (req, res) => {
  try {
    const { question, financialPortraitMarkdown, country, conversationHistory } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Pergunta obrigatória' });
    }

    const ai = getGeminiClient();

    // Montar o System Instruction completo com o Retrato Financeiro injetado
    const fullSystemInstruction = `${systemPromptTemplate}

---
${financialPortraitMarkdown || 'Nenhum dado financeiro disponível no momento.'}
`;

    // Se a chave estiver disponível, usar o Gemini 3.8 Flash
    if (ai) {
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Adicionar histórico recente se houver
      if (Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory.slice(-6)) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: question }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || 'Desculpe, não consegui processar a resposta agora.';
      return res.json({ reply: replyText, source: 'gemini' });
    }

    // Fallback inteligente determinístico caso a GEMINI_API_KEY ainda não esteja configurada no ambiente
    const isAO = country === 'AO';
    const cur = isAO ? 'Kz' : 'R$';
    const langGreeting = isAO ? 'Olá! Aqui é o Prumo.' : 'Olá! Sou o Prumo.';

    let fallbackReply = `${langGreeting} Analisando o seu retrato financeiro: `;

    if (/cenario|cenário|simula|simulação|projetar|futuro/i.test(question)) {
      fallbackReply += `Na sua simulação de cenários de 24 meses, manter a consistência de aportes e cortar despesas fixas desnecessárias amplia significativamente a sua reserva. Experimente ativar o evento de corte de custos para ver o reflexo na curva. Que tal revisar seus orçamentos do mês agora?`;
    } else if (/reserva|emergencia|emergência/i.test(question)) {
      fallbackReply += `Para a sua profissão, uma reserva de emergência segura deve cobrir de 3 a 6 meses do seu custo de vida básico. Verifique na aba de Metas se a sua meta primária já contempla esse fundo.`;
    } else if (/orçamento|gasto|limite|estourou/i.test(question)) {
      fallbackReply += `Acompanhe as categorias com alertas de atenção (>80%) no seu painel. Realoque gastos discricionários para evitar comprometer a sua meta de poupança deste mês.`;
    } else {
      fallbackReply += `Seus dados e transações estão consolidados com sucesso em ${cur}. Posso te ajudar a planejar orçamentos por categoria, interpretar o gráfico de projeção de 24 meses ou sugerir o próximo passo para sua meta principal. Como prefere começar?`;
    }

    return res.json({
      reply: fallbackReply,
      source: 'heuristic_fallback',
    });
  } catch (err: any) {
    console.error('Erro no copiloto:', err);
    return res.status(500).json({
      error: 'Falha ao processar resposta do copiloto',
      details: err.message,
    });
  }
});

// Endpoint de categorização inteligente automática
app.post('/api/categorize', async (req, res) => {
  try {
    const { description, amount, country } = req.body;
    if (!description) {
      return res.json({ category: 'Outros', confidence: 0.5 });
    }

    const descLower = description.toLowerCase();

    // Regras rápidas baseadas em palavras-chave do Brasil e Angola
    if (/uber|99|táxi|taxi|gasolina|posto|sonangol|combustivel|combustível|pedágio|metro|metrô/i.test(descLower)) {
      return res.json({ category: 'Transporte', confidence: 0.95 });
    }
    if (/ifood|mercado|supermercado|pão de açúcar|carrefour|kero|hiper|restaurante|padaria|almoço|lanche|café/i.test(descLower)) {
      return res.json({ category: 'Alimentação', confidence: 0.95 });
    }
    if (/aluguel|condomínio|luz|energia|ende|água|epal|iptu|reforma|gás/i.test(descLower)) {
      return res.json({ category: 'Moradia', confidence: 0.95 });
    }
    if (/netflix|spotify|aws|google|icloud|assinatura|curso|software|chatgpt|adobe/i.test(descLower)) {
      return res.json({ category: 'Serviços & Assinaturas', confidence: 0.92 });
    }
    if (/curso|faculdade|livro|escola|udemy|alura|certificação/i.test(descLower)) {
      return res.json({ category: 'Educação', confidence: 0.92 });
    }
    if (/farmácia|drogaria|consulta|médico|dentista|exame|unimed|hospital/i.test(descLower)) {
      return res.json({ category: 'Saúde', confidence: 0.93 });
    }
    if (/cinema|show|viagem|hotel|praia|passagem|bar|festa/i.test(descLower)) {
      return res.json({ category: 'Lazer & Cultura', confidence: 0.9 });
    }
    if (/honorários|salário|pix recebido|cliente|freelance|faturamento|pro-labore|multicaixa receb/i.test(descLower)) {
      return res.json({ category: 'Salário / Honorários', confidence: 0.95 });
    }
    if (/dividendo|rendimento|cdi|tesouro|juros|fii/i.test(descLower)) {
      return res.json({ category: 'Rendimento / Investimento', confidence: 0.95 });
    }
    if (/macbook|laptop|notebook|monitor|teclado|equipamento|celular|ferramenta/i.test(descLower)) {
      return res.json({ category: 'Equipamentos & Trabalho', confidence: 0.9 });
    }

    return res.json({ category: 'Outros', confidence: 0.7 });
  } catch (err) {
    return res.json({ category: 'Outros', confidence: 0.5 });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Prumo Server rodando em http://localhost:${PORT}`);
  });
}

startServer();
