/**
 * Parser OFX (Open Financial Exchange) — versão 1.x SGML e 2.x XML.
 *
 * Formato típico de extrato bancário brasileiro (Itaú, Nubank, BB, Bradesco,
 * Inter exportam OFX):
 *
 * OFXHEADER:100
 * DATA:OFXSGML
 * ...
 * <OFX>
 *  <BANKMSGSRSV1><STMTTRNRS><STMTRS>
 *   <BANKTRANLIST>
 *    <DTSTART>20260801
 *    <STMTTRN>
 *     <TRNTYPE>DEBIT
 *     <DTPOSTED>20260815120000
 *     <TRNAMT>-150.00
 *     <MEMO>PGTO CONTA DE LUZ
 *    </STMTTRN>
 *   </BANKTRANLIST>
 *  ...
 *
 * Observações:
 * - SGML OFX não fecha tags (<TRNTYPE>DEBIT sem </TRNTYPE>) — usamos regex
 *   tolerante, não um parser XML.
 * - Datas: YYYYMMDD[HHMMSS[...]] (offset opcional no final é ignorado).
 * - Valores: ponto como decimal (padrão OFX). Comma é tolerado.
 * - Encriptado/compactado não é suportado; arquivos > 5 MB são recusados.
 */

import { Transaction } from '../types';

const MAX_OFX_SIZE = 5 * 1024 * 1024; // 5 MB

export interface OfxParseResult {
  transactions: OfxParsedTransaction[];
  periodStart?: string;
  periodEnd?: string;
  currency?: string;
  bankId?: string;
  accountId?: string;
  warnings: string[];
}

export interface OfxParsedTransaction {
  /** YYYY-MM-DD */
  date: string;
  amount: number; // negativo = despesa
  description: string;
  type: 'income' | 'expense';
  fitId?: string;
  memo?: string;
}

export interface OfxParseError {
  message: string;
}

/** Decodifica bytes → texto (UTF-8 com fallback Latin-1 para bancos antigos). */
function decodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      text = new TextDecoder('iso-8859-1').decode(bytes);
    } catch {
      text = new TextDecoder().decode(bytes);
    }
  }
  // BOM
  return text.replace(/^\uFEFF/, '');
}

/** YYYYMMDD[HHMMSS[.XXX][:tz]] → 'YYYY-MM-DD' (fuso local, sem virar dia). */
export function parseOfxDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  // valida mês/dia plausíveis
  const mi = parseInt(mo, 10);
  const di = parseInt(d, 10);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** '-1.234,56' | '-1234.56' → number */
export function parseOfxAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s/g, '');
  if (!s) return null;
  // formato pt: 1.234,56 (ponto = milhar, vírgula = decimal)
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Extrai o valor de uma tag OFX (SGML: `<TAG>valor\n`, XML: `<TAG>valor</TAG>`).
 * Retorna null se a tag não existir.
 */
function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

/** Extrai blocos `<STMTTRN>...</STMTTRN>` (SGML sem fechamento também funciona). */
function extractStmtTrnBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>|$))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

/**
 * Faz o parse de um arquivo OFX e devolve transações prontas para importação
 * (ainda sem id/userId — o chamador completa os campos de identidade).
 */
export function parseOfx(buffer: ArrayBuffer): OfxParseResult | OfxParseError {
  if (buffer.byteLength === 0) return { message: 'Arquivo vazio.' };
  if (buffer.byteLength > MAX_OFX_SIZE) {
    return { message: 'Arquivo muito grande (limite de 5 MB).' };
  }

  const text = decodeBuffer(buffer);
  if (!/OFXHEADER|<OFX/i.test(text)) {
    return { message: 'Arquivo não parece ser um OFX válido (cabeçalho OFXHEADER/<OFX> ausente).' };
  }

  const warnings: string[] = [];

  // Período do extrato
  const dtStart = extractTag(text, 'DTSTART');
  const dtEnd = extractTag(text, 'DTEND');
  const periodStart = dtStart ? parseOfxDate(dtStart) ?? undefined : undefined;
  const periodEnd = dtEnd ? parseOfxDate(dtEnd) ?? undefined : undefined;

  // Moeda e banco (opcionais)
  const currency = (extractTag(text, 'CURDEF') || undefined) ?? undefined;
  const bankId = extractTag(text, 'BANKID') || undefined;
  const accountId = extractTag(text, 'ACCTID') || undefined;

  const rawBlocks = extractStmtTrnBlocks(text);
  if (rawBlocks.length === 0) {
    return { message: 'Nenhuma transação encontrada no OFX (bloco STMTTRN ausente).' };
  }

  const transactions: OfxParsedTransaction[] = [];
  const fitIds = new Set<string>();
  let skipped = 0;

  for (const block of rawBlocks) {
    const dtPosted = extractTag(block, 'DTPOSTED') || extractTag(block, 'DTUSER');
    const trnAmt = extractTag(block, 'TRNAMT');
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    const fitId = extractTag(block, 'FITID') || undefined;

    const date = dtPosted ? parseOfxDate(dtPosted) : null;
    const amount = trnAmt !== null ? parseOfxAmount(trnAmt) : null;

    if (!date || amount === null) {
      skipped += 1;
      continue;
    }

    // Dedup dentro do arquivo por FITID quando presente
    if (fitId) {
      if (fitIds.has(fitId)) {
        skipped += 1;
        continue;
      }
      fitIds.add(fitId);
    }

    const description = (name && name.trim()) || memo || 'Transação importada (OFX)';

    transactions.push({
      date,
      amount,
      description,
      type: amount < 0 ? 'expense' : 'income',
      fitId,
      memo: memo || undefined,
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} lançamento(s) ignorado(s) por data ou valor inválidos.`);
  }

  if (transactions.length === 0) {
    return { message: 'O OFX não contém transações válidas para importar.' };
  }

  return { transactions, periodStart, periodEnd, currency, bankId, accountId, warnings };
}

/** OFX em cache de importação já classificado offline (prumo). */
export function classifyImportedDescription(description: string): string {
  const d = description.toLowerCase();
  if (/uber|99|táxi|taxi|gasolina|posto|sonangol|combustivel|combustível|pedágio|metro|metrô|estacionamento/i.test(d)) {
    return 'Transporte';
  }
  if (/ifood|mercado|supermercado|pão de açúcar|carrefour|kero|hiper|restaurante|padaria|almoço|lanche|café|bife|pizza/i.test(d)) {
    return 'Alimentação';
  }
  if (/aluguel|condomínio|luz|energia|ende|água|epal|iptu|reforma|gás|manutenção/i.test(d)) {
    return 'Moradia';
  }
  if (/netflix|spotify|aws|google|icloud|assinatura|curso|software|chatgpt|adobe|starlink|figma/i.test(d)) {
    return 'Serviços & Assinaturas';
  }
  if (/faculdade|livro|escola|udemy|alura|certificação|mensalidade/i.test(d)) {
    return 'Educação';
  }
  if (/farmácia|drogaria|consulta|médico|dentista|exame|unimed|hospital|clínica/i.test(d)) {
    return 'Saúde';
  }
  if (/cinema|show|viagem|hotel|praia|passagem|bar|festa|ingresso|teatro/i.test(d)) {
    return 'Lazer & Cultura';
  }
  if (/salário|salario|pix recebido|ordenado|remuneração/i.test(d)) {
    return 'Salário / Honorários';
  }
  return 'Outros';
}

/** Converte transações OFX para o modelo interno (id gerado pelo chamador). */
export function ofxToTransactions(parsed: OfxParsedTransaction[]): Omit<Transaction, 'id' | 'createdAt' | 'userId'>[] {
  return parsed.map((t) => ({
    accountId: null,
    description: t.description,
    amount: Math.abs(t.amount),
    type: t.type,
    category: classifyImportedDescription(t.description),
    source: 'ofx_import' as const,
    occurredAt: t.date,
    merchant: t.memo || undefined,
  }));
}
