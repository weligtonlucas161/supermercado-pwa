import { AuditItem } from '../types';

/**
 * Converte string UTF-8 para bytes WinAnsi (Cp1252) para fontes PDF Type1 padrão (Helvetica),
 * preservando acentuação em português (á, é, í, ó, ú, ã, õ, ç, º, etc.).
 */
function toWinAnsiBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      bytes.push(code);
    } else if (code >= 160 && code <= 255) {
      bytes.push(code);
    } else if (code === 8226) {
      bytes.push(149); // bullet •
    } else if (code === 8211 || code === 8212) {
      bytes.push(45); // hyphen -
    } else {
      bytes.push(63); // '?'
    }
  }
  return bytes;
}

function escapePdfLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current ? current.length + 1 : 0) + w.length <= maxChars) {
      current = current ? `${current} ${w}` : w;
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
}

export function exportAuditReportToPDF(
  audit: AuditItem,
  options: { storeName?: string; showSystemStock?: boolean } = {}
): void {
  const isInventory = audit.type === 'INVENTARIO';
  const showSystem = Boolean(options.showSystemStock);
  const dateLabel = audit.dataAuditoria || (audit.date ? audit.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const timeLabel = audit.horaAuditoria || (audit.startedAtMs ? new Date(audit.startedAtMs).toTimeString().slice(0, 8) : '');
  const participantsText = audit.participants && audit.participants.length > 0 ? audit.participants.join(', ') : audit.auditor;

  const lines: PdfLine[] = [
    { text: `RELATORIO OFICIAL - ${audit.title.toUpperCase()}`, size: 13, bold: true },
    { text: `Loja: ${options.storeName || audit.lojaId || '-'}   |   Setor: ${audit.department || '-'}`, size: 9, bold: true },
    { text: `Data: ${dateLabel}   |   Hora: ${timeLabel || '-'}   |   Chave: ${audit.chaveAuditoria || audit.id}`, size: 8.5 },
    { text: `Iniciada por: ${audit.startedBy || audit.auditor}   |   Finalizada por: ${audit.auditor}`, size: 8.5 },
    { text: `Participantes: ${participantsText}`, size: 8.5 },
    { text: `Duracao: ${audit.durationLabel || '-'}   |   Status: ${audit.status}`, size: 8.5 },
    { text: '----------------------------------------------------------------------------------------------------', size: 8 },
    {
      text: isInventory
        ? `RESUMO INVENTARIO: Total Esperado: ${audit.totalItems ?? audit.itemsCount}  |  Contados (Bip): ${audit.confirmedItems ?? audit.itemsCount}  |  Nao Bipados: ${audit.pendingItems ?? 0}`
        : `RESUMO PRESENCA: Total Setor: ${audit.totalItems ?? audit.itemsCount}  |  Confirmados (Cam): ${audit.confirmedItems ?? audit.itemsCount}  |  Ausentes: ${audit.pendingItems ?? 0}  |  Taxa: ${audit.presenceRate || '100%'}`,
      size: 9,
      bold: true,
    },
    { text: '----------------------------------------------------------------------------------------------------', size: 8 },
  ];

  // Seção 1: Itens Bipados / Contados
  const confirmed = audit.confirmedList || [];
  lines.push({ text: `1. ITENS BIPADOS VIA CAMERA (${confirmed.length})`, size: 10, bold: true });
  if (confirmed.length === 0) {
    lines.push({ text: 'Nenhum item bipado nesta sessao.', size: 8.5, indent: 8 });
  } else {
    confirmed.forEach((item, idx) => {
      const qtyPart = isInventory
        ? showSystem && typeof item.systemQuantity === 'number'
          ? ` | Fisico: ${item.physicalQuantity ?? 0} | Sist: ${item.systemQuantity} | Div: ${(item.physicalQuantity ?? 0) - item.systemQuantity}`
          : ` | Qtd. Fisica: ${item.physicalQuantity ?? 0} un`
        : '';
      const raw = `${idx + 1}. ${item.name} [EAN: ${item.ean}]${qtyPart} - ${item.scannedBy || '-'} (${item.scannedAt})`;
      wrapText(raw, 92).forEach((chunk, cIdx) => {
        lines.push({ text: chunk, size: 8.5, indent: cIdx === 0 ? 6 : 16 });
      });
    });
  }

  lines.push({ text: '', size: 6 });

  // Seção 2: Itens Não Bipados / Pendentes
  const pending = audit.pendingList || [];
  lines.push({ text: `2. ITENS NAO BIPADOS / PENDENTES (${pending.length})`, size: 10, bold: true });
  if (pending.length === 0) {
    lines.push({ text: 'Todos os itens do setor foram bipados.', size: 8.5, indent: 8 });
  } else {
    pending.forEach((item, idx) => {
      const stockPart = showSystem && typeof (item.systemQuantity ?? item.stock) === 'number'
        ? ` | Sist: ${item.systemQuantity ?? item.stock}`
        : '';
      const raw = `${idx + 1}. ${item.name} [EAN: ${item.ean}]${stockPart}`;
      wrapText(raw, 92).forEach((chunk, cIdx) => {
        lines.push({ text: chunk, size: 8.5, indent: cIdx === 0 ? 6 : 16 });
      });
    });
  }

  // Seção 3: Rupturas (somente Presença ou Gerente)
  const ruptures = audit.ruptureList || [];
  if ((!isInventory || showSystem) && ruptures.length > 0) {
    lines.push({ text: '', size: 6 });
    lines.push({ text: `3. RUPTURAS IMINENTES (${ruptures.length})`, size: 10, bold: true });
    ruptures.forEach((item, idx) => {
      const raw = `${idx + 1}. ${item.name} [EAN: ${item.ean}] - Saldo: ${item.stock} (Min: ${item.minStock})`;
      wrapText(raw, 92).forEach((chunk, cIdx) => {
        lines.push({ text: chunk, size: 8.5, indent: cIdx === 0 ? 6 : 16 });
      });
    });
  }

  // Paginação A4 (595 x 842 pt)
  const pageHeight = 842;
  const marginTop = 44;
  const marginBottom = 40;
  const marginLeft = 36;

  const pages: string[] = [];
  let currentOps: string[] = [];
  let y = pageHeight - marginTop;

  const flushPage = () => {
    if (currentOps.length > 0) {
      pages.push(currentOps.join('\n'));
      currentOps = [];
    }
    y = pageHeight - marginTop;
  };

  for (const line of lines) {
    const fontSize = line.size ?? 9;
    const step = fontSize + 4.5;
    if (y - step < marginBottom) {
      flushPage();
    }
    if (line.text) {
      const font = line.bold ? '/F2' : '/F1';
      const x = marginLeft + (line.indent ?? 0);
      currentOps.push(`BT ${font} ${fontSize} Tf ${x} ${y.toFixed(1)} Td (${escapePdfLiteral(line.text)}) Tj ET`);
    }
    y -= step;
  }
  flushPage();
  if (pages.length === 0) pages.push('BT /F1 10 Tf 36 790 Td (Relatorio vazio) Tj ET');

  // Montagem dos objetos PDF 1.4
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesIdPlaceholder = addObj(''); // idx 2 -> object 3

  const pageIds: number[] = [];
  for (const content of pages) {
    const contentId = addObj(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesIdPlaceholder - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesIdPlaceholder} 0 R >>`);

  // Constrói arquivo binário com offsets exatos em WinAnsi
  const chunks: number[][] = [];
  let offset = 0;
  const pushText = (s: string) => {
    const b = toWinAnsiBytes(s);
    chunks.push(b);
    offset += b.length;
  };

  pushText('%PDF-1.4\n');
  const offsets: number[] = [0];
  objects.forEach((body, idx) => {
    offsets.push(offset);
    pushText(`${idx + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = offset;
  pushText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLen = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const pdfBytes = new Uint8Array(totalLen);
  let ptr = 0;
  for (const arr of chunks) {
    pdfBytes.set(arr, ptr);
    ptr += arr.length;
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeSetor = (audit.department || 'geral').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTime = (timeLabel || '00-00-00').replace(/:/g, '-');
  link.href = url;
  link.download = `auditoria_${safeSetor}_${dateLabel}_${safeTime}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
