import { validateHexColor } from './security';
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

function encodePdfLiteral(text: string): string {
  // Octal escapes keep the content stream ASCII while preserving WinAnsi glyphs.
  return toWinAnsiBytes(text).map(byte => {
    if (byte === 40 || byte === 41 || byte === 92) return '\\' + String.fromCharCode(byte);
    if (byte > 126) return '\\' + byte.toString(8).padStart(3, '0');
    return String.fromCharCode(byte);
  }).join('');
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
      let remainder = w;
      while (remainder.length > maxChars) {
        lines.push(remainder.slice(0, maxChars));
        remainder = remainder.slice(maxChars);
      }
      current = remainder;
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
  section?: 'confirmed' | 'pending' | 'rupture';
}

export function exportAuditReportToPDF(
  audit: AuditItem,
  options: { storeName?: string; storeColor?: string; showSystemStock?: boolean } = {}
): void {
  const isInventory = audit.type === 'INVENTARIO';
  const showSystem = Boolean(options.showSystemStock);
  const dateLabel = audit.dataAuditoria || (audit.date ? audit.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const timeLabel = audit.horaAuditoria || (audit.startedAtMs ? new Date(audit.startedAtMs).toTimeString().slice(0, 8) : '');
  const participantsText = audit.participants && audit.participants.length > 0 ? audit.participants.join(', ') : audit.auditor;

  const lines: PdfLine[] = [
    { text: `Loja: ${options.storeName || audit.lojaId || '-'}   |   Setor: ${audit.department || '-'}`, size: 9, bold: true },
    { text: `Data: ${dateLabel}   |   Hora: ${timeLabel || '-'}   |   Chave: ${audit.chaveAuditoria || audit.id}`, size: 8.5 },
    { text: `Iniciada por: ${audit.startedBy || audit.auditor}   |   Finalizada por: ${audit.auditor}`, size: 8.5 },
    { text: `Participantes: ${participantsText}`, size: 8.5 },
    { text: `Duração: ${audit.durationLabel || '-'}   |   Status: ${audit.status}`, size: 8.5 },
  ];

  // Seção 1: Itens Bipados / Contados
  const confirmed = audit.confirmedList || [];
  lines.push({ text: `1. ITENS BIPADOS / CONFERIDOS (${confirmed.length})`, size: 10, bold: true, section: 'confirmed' });
  if (confirmed.length === 0) {
    lines.push({ text: 'Nenhum item bipado nesta sessão.', size: 8.5, indent: 8 });
  } else {
    confirmed.forEach((item, idx) => {
      const qtyPart = isInventory
        ? showSystem && typeof item.systemQuantity === 'number'
          ? ` | Físico: ${item.physicalQuantity ?? 0} | Sist: ${item.systemQuantity} | Div: ${(item.physicalQuantity ?? 0) - item.systemQuantity}`
          : ` | Qtd. física: ${item.physicalQuantity ?? 0} un`
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
  lines.push({ text: `2. ITENS NÃO BIPADOS / PENDENTES (${pending.length})`, size: 10, bold: true, section: 'pending' });
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
    lines.push({ text: `3. RUPTURAS IMINENTES (${ruptures.length})`, size: 10, bold: true, section: 'rupture' });
    ruptures.forEach((item, idx) => {
      const raw = `${idx + 1}. ${item.name} [EAN: ${item.ean}] - Saldo: ${item.stock} (Min: ${item.minStock})`;
      wrapText(raw, 92).forEach((chunk, cIdx) => {
        lines.push({ text: chunk, size: 8.5, indent: cIdx === 0 ? 6 : 16 });
      });
    });
  }

  const accentHex = validateHexColor(options.storeColor);
  const accent = [1, 3, 5].map(start => parseInt(accentHex.slice(start, start + 2), 16) / 255).join(' ');
  const ink = '0.06 0.09 0.16';
  const muted = '0.28 0.33 0.41';
  const border = '0.89 0.91 0.94';
  const margin = 36;
  const width = 523;
  const top = 735;
  const bottom = 58;
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = top;
  let section: PdfLine | undefined;

  function rect(x: number, bottomY: number, w: number, h: number, color: string) {
    ops.push(`q ${color} rg ${x} ${bottomY} ${w} ${h} re f Q`);
  }
  function text(value: string, x: number, baseline: number, size: number, bold = false, color = ink) {
    ops.push(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${baseline} Td (${encodePdfLiteral(value)}) Tj ET`);
  }
  function sectionHeader(line: PdfLine, continued = false) {
    const color = line.section === 'confirmed' ? '0.82 0.98 0.90' :
      line.section === 'pending' ? '1 0.95 0.81' : '1 0.88 0.90';
    rect(margin, y - 19, width, 23, color);
    text(continued ? `${line.text} (continuação)` : line.text, margin + 9, y - 11, 10, true);
    y -= 31;
  }
  function startPage() {
    ops = [];
    pages.push(ops);
    rect(0, 835, 595, 7, accent);
    rect(margin, 803, 10, 10, accent);
    text('SuperPWA OpSys', margin + 17, 803, 11, true);
    const title = wrapText(audit.title, 48).slice(0, 2);
    title.forEach((part, index) => text(part, margin, 779 - index * 19, 17, true));
    rect(margin, 747, width, 1, border);
    y = top;
  }

  startPage();
  const presenceMetrics = [
    ['Total do setor', String(audit.totalItems ?? audit.itemsCount), '0.95 0.96 0.98'],
    [isInventory ? 'Contados' : 'Confirmados', String(audit.confirmedItems ?? audit.itemsCount), '0.82 0.98 0.90'],
    [isInventory ? 'Pendentes' : 'Ausentes', String(audit.pendingItems ?? 0), '1 0.95 0.81'],
  ];
  if (!isInventory) presenceMetrics.push(['Taxa de presença', audit.presenceRate || '100%', '0.95 0.96 0.98']);
  const cardWidth = (width - (presenceMetrics.length - 1) * 8) / presenceMetrics.length;
  presenceMetrics.forEach(([label, value, color], index) => {
    const x = margin + index * (cardWidth + 8);
    rect(x, y - 47, cardWidth, 47, color);
    text(label, x + 9, y - 15, 9, true, muted);
    text(value, x + 9, y - 35, 16, true);
  });
  y -= 65;

  for (const line of lines) {
    if (line.section) {
      if (y - 51 < bottom) startPage();
      section = line;
      sectionHeader(line);
      continue;
    }
    const size = line.size ?? 9;
    const step = size + 4.5;
    for (const part of wrapText(line.text, 91)) {
      if (y - step < bottom) {
        startPage();
        if (section) sectionHeader(section, true);
      }
      if (part) text(part, margin + (line.indent ?? 0), y, size, line.bold, line.indent ? ink : muted);
      y -= step;
    }
  }

  const contentStreams = pages.map((commands, index) => [
    ...commands,
    `q ${border} rg ${margin} 42 ${width} 1 re f Q`,
    `BT ${muted} rg /F1 8 Tf ${margin} 27 Td (SuperPWA OpSys) Tj ET`,
    `BT ${muted} rg /F1 8 Tf 494 27 Td (${encodePdfLiteral(`Página ${index + 1} de ${pages.length}`)}) Tj ET`,
  ].join('\n'));

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
  for (const content of contentStreams) {
    const contentId = addObj(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesIdPlaceholder - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesIdPlaceholder} 0 R >>`);

  // Preserve os delimitadores do formato e conte os bytes usados no xref.
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const pushText = (s: string) => {
    const b = encoder.encode(s);
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
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

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
  const safeDate = dateLabel.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeTime = (timeLabel || '00-00-00').replace(/:/g, '-');
  link.href = url;
  link.download = `auditoria_${safeSetor}_${safeDate}_${safeTime}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
