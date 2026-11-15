/**
 * Sharing and export helpers for Good JuJu cards.
 */

export function isPublishedCard(card, masterCards = []) {
  return Boolean(
    card &&
    typeof card.id === 'string' &&
    !card.id.startsWith('user-') &&
    masterCards.some(m => m.id === card.id)
  );
}

export function isPdfCard(card) {
  return Boolean(
    card &&
    (card.sourceType === 'pdf' || (typeof card.id === 'string' && card.id.startsWith('user-pdf-')))
  );
}

function cardSlug(card) {
  return (card?.title || 'card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'card';
}

export function buildCardShareUrl(
  card,
  { back = false, baseHref = typeof window !== 'undefined' ? window.location.href : '', masterCards = [] } = {}
) {
  if (!baseHref || !isPublishedCard(card, masterCards)) return null;
  const url = new URL(baseHref);
  url.hash = '';
  url.search = '';
  url.searchParams.set('card', card.id);
  if (back) url.searchParams.set('side', 'back');
  return url.toString();
}

export function parseSharedCardParams(search = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search);
  return {
    cardId: params.get('card')?.trim() || null,
    back: params.get('side') === 'back'
  };
}

export async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to execCommand fallback if clipboard API is unavailable or blocked.
    }
  }
  if (typeof document !== 'undefined') {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.style.left = '-9999px';
    document.body.append(area);
    area.select();
    try {
      if (document.execCommand('copy')) return;
    } finally {
      area.remove();
    }
  }
  throw Error('Unable to copy link to clipboard.');
}

export async function copyCardLink(card, { back = false, masterCards = [], onToast } = {}) {
  if (!card) return { shared: false, reason: 'no-card', url: null };
  const url = buildCardShareUrl(card, { back, masterCards });
  if (!url) {
    onToast?.('Personal cards stay in this browser and do not have a public link. Use Share as Image instead.');
    return { shared: false, reason: 'personal-card', url: null };
  }
  await copyTextToClipboard(url);
  onToast?.('Card link copied to clipboard.');
  return { shared: true, method: 'clipboard', url };
}

function wrapCanvasText(ctx, text, maxWidth) {
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
        } else {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function renderCardFaceCanvas(card, side = 'front') {
  const canvas = document.createElement('canvas');

  if (card.kind === 'physical') {
    const img = new Image();
    img.src = card[side];
    await img.decode();
    canvas.width = img.naturalWidth || 1000;
    canvas.height = img.naturalHeight || 1400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = 1000;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');
    const bg = card.background || '#214f49';
    const fg = card.color || '#fff8e9';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = 800;
    const maxHeight = 1040;
    let fontSize = side === 'back' ? 42 : 54;
    let lines = [];
    let lineHeight = fontSize * 1.55;

    while (fontSize >= 24) {
      ctx.font = `${fontSize}px Georgia, serif`;
      lines = wrapCanvasText(ctx, card[side] || '', maxWidth);
      lineHeight = fontSize * 1.55;
      if (lines.length * lineHeight <= maxHeight) break;
      fontSize -= 4;
    }

    const ornamentGap = 72;
    const totalTextHeight = lines.length * lineHeight;
    const blockHeight = ornamentGap + totalTextHeight;
    const startY = Math.max(150, (canvas.height - blockHeight) / 2);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.font = '56px Georgia, serif';
    ctx.fillText('✧', canvas.width / 2, startY);
    ctx.restore();

    ctx.font = `${fontSize}px Georgia, serif`;
    let y = startY + ornamentGap + lineHeight / 2;
    for (const line of lines) {
      if (y > canvas.height - 90) break;
      if (line) ctx.fillText(line, canvas.width / 2, y);
      y += lineHeight;
    }
  }

  return { canvas, width: canvas.width, height: canvas.height };
}

function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(Error('Could not export card image.'));
    }, type, quality);
  });
}

export async function renderCardFaceBlob(card, side = 'front') {
  const filename = `${cardSlug(card)}-${side}.png`;
  const { canvas, width, height } = await renderCardFaceCanvas(card, side);
  const blob = await canvasToBlob(canvas, 'image/png');
  return { blob, filename, width, height };
}

export async function renderCombinedCardBlob(card) {
  const front = await renderCardFaceCanvas(card, 'front');
  const back = await renderCardFaceCanvas(card, 'back');
  const gap = Math.max(24, Math.round(Math.max(front.width, back.width) * 0.04));
  const pad = gap;
  const maxHeight = Math.max(front.height, back.height);

  const combined = document.createElement('canvas');
  combined.width = pad + front.width + gap + back.width + pad;
  combined.height = pad + maxHeight + pad;

  const ctx = combined.getContext('2d');
  ctx.fillStyle = '#efeee5';
  ctx.fillRect(0, 0, combined.width, combined.height);

  const frontY = pad + Math.round((maxHeight - front.height) / 2);
  const backY = pad + Math.round((maxHeight - back.height) / 2);
  ctx.drawImage(front.canvas, pad, frontY);
  ctx.drawImage(back.canvas, pad + front.width + gap, backY);

  const blob = await canvasToBlob(combined, 'image/png');
  return {
    blob,
    filename: `${cardSlug(card)}-front-back.png`,
    width: combined.width,
    height: combined.height
  };
}

export function createTwoPagePdfBytes({ frontJpeg, frontWidth, frontHeight, backJpeg, backWidth, backHeight }) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let byteLength = 0;

  const pushBytes = bytes => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushText = text => pushBytes(encoder.encode(text));

  const toPoints = px => Math.max(72, Math.round(((px * 72) / 150) * 100) / 100);
  const fw = toPoints(frontWidth);
  const fh = toPoints(frontHeight);
  const bw = toPoints(backWidth);
  const bh = toPoints(backHeight);

  const page1Stream = `q ${fw} 0 0 ${fh} 0 0 cm /Im1 Do Q\n`;
  const page2Stream = `q ${bw} 0 0 ${bh} 0 0 cm /Im2 Do Q\n`;

  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const writeObj = (id, body) => {
    offsets[id] = byteLength;
    pushText(`${id} 0 obj\n`);
    if (typeof body === 'string') pushText(body);
    else body();
    pushText('\nendobj\n');
  };

  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  writeObj(2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>');
  writeObj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fw} ${fh}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>`);
  writeObj(4, `<< /Length ${page1Stream.length} >>\nstream\n${page1Stream}endstream`);
  writeObj(5, () => {
    pushText(`<< /Type /XObject /Subtype /Image /Width ${frontWidth} /Height ${frontHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${frontJpeg.length} >>\nstream\n`);
    pushBytes(frontJpeg);
    pushText('\nendstream');
  });
  writeObj(6, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${bw} ${bh}] /Resources << /XObject << /Im2 8 0 R >> >> /Contents 7 0 R >>`);
  writeObj(7, `<< /Length ${page2Stream.length} >>\nstream\n${page2Stream}endstream`);
  writeObj(8, () => {
    pushText(`<< /Type /XObject /Subtype /Image /Width ${backWidth} /Height ${backHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${backJpeg.length} >>\nstream\n`);
    pushBytes(backJpeg);
    pushText('\nendstream');
  });

  const xrefOffset = byteLength;
  pushText('xref\n0 9\n0000000000 65535 f \n');
  for (let i = 1; i <= 8; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(byteLength);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

async function fetchOriginalPdfBlob(card) {
  if (card?.sourcePdf instanceof Blob) return card.sourcePdf;
  if (typeof card?.sourcePdf === 'string' && card.sourcePdf.startsWith('data:application/pdf')) {
    const res = await fetch(card.sourcePdf);
    if (res.ok) return res.blob();
  }
  if (card?.sourceType === 'pdf' && card.collection && card.sourceFiles?.[0] && typeof fetch === 'function') {
    const relPath = `All Decks/${encodeURIComponent(card.collection)}/${encodeURIComponent(card.sourceFiles[0])}`;
    const url = typeof window !== 'undefined' ? new URL(relPath, window.location.href).href : relPath;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
        return new Blob([buf], { type: 'application/pdf' });
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function buildTwoPagePdfBlob(card) {
  const front = await renderCardFaceCanvas(card, 'front');
  const back = await renderCardFaceCanvas(card, 'back');
  const [frontBlob, backBlob] = await Promise.all([
    canvasToBlob(front.canvas, 'image/jpeg', 0.92),
    canvasToBlob(back.canvas, 'image/jpeg', 0.92)
  ]);
  const [frontJpeg, backJpeg] = await Promise.all([
    frontBlob.arrayBuffer().then(b => new Uint8Array(b)),
    backBlob.arrayBuffer().then(b => new Uint8Array(b))
  ]);
  const pdfBytes = createTwoPagePdfBytes({
    frontJpeg,
    frontWidth: front.width,
    frontHeight: front.height,
    backJpeg,
    backWidth: back.width,
    backHeight: back.height
  });
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    filename: `${cardSlug(card)}.pdf`
  };
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

async function tryNativeShareFiles(card, files) {
  if (
    !files.length ||
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    !navigator.canShare({ files })
  ) {
    return { attempted: false, shared: false };
  }
  try {
    await navigator.share({ title: card.title, text: card.title, files });
    return { attempted: true, shared: true };
  } catch (err) {
    if (err?.name === 'AbortError') return { attempted: true, shared: false, aborted: true };
    return { attempted: true, shared: false };
  }
}

export async function sharePdfCard(card, { onToast } = {}) {
  if (!card) return { shared: false, reason: 'no-card' };
  const filename = `${cardSlug(card)}.pdf`;
  const originalBlob = await fetchOriginalPdfBlob(card);
  const pdfBlob = originalBlob || (await buildTwoPagePdfBlob(card)).blob;
  const source = originalBlob ? 'original-pdf' : 'generated-pdf';

  if (typeof File === 'function') {
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
    const native = await tryNativeShareFiles(card, [file]);
    if (native.aborted) return { shared: false, reason: 'aborted', source };
    if (native.shared) {
      onToast?.(originalBlob ? 'Original two-page PDF shared.' : 'Two-page PDF shared.');
      return { shared: true, method: 'native-pdf', filename, source };
    }
  }

  downloadBlob(pdfBlob, filename);
  onToast?.(originalBlob ? 'Original two-page PDF exported.' : 'Two-page PDF exported.');
  return { shared: true, method: 'download', filename, source };
}

export async function shareCardAsImage(card, { onToast } = {}) {
  if (!card) return { shared: false, reason: 'no-card' };
  if (isPdfCard(card)) return sharePdfCard(card, { onToast });

  const [frontResult, backResult] = await Promise.all([
    renderCardFaceBlob(card, 'front'),
    renderCardFaceBlob(card, 'back')
  ]);

  if (typeof File === 'function') {
    const frontFile = new File([frontResult.blob], frontResult.filename, { type: 'image/png' });
    const backFile = new File([backResult.blob], backResult.filename, { type: 'image/png' });
    const multi = await tryNativeShareFiles(card, [frontFile, backFile]);
    if (multi.aborted) return { shared: false, reason: 'aborted' };
    if (multi.shared) {
      onToast?.('Front and back card images shared.');
      return {
        shared: true,
        method: 'native-images',
        filenames: [frontResult.filename, backResult.filename]
      };
    }
  }

  const combined = await renderCombinedCardBlob(card);
  if (typeof File === 'function') {
    const combinedFile = new File([combined.blob], combined.filename, { type: 'image/png' });
    const single = await tryNativeShareFiles(card, [combinedFile]);
    if (single.aborted) return { shared: false, reason: 'aborted' };
    if (single.shared) {
      onToast?.('Front and back card image shared.');
      return { shared: true, method: 'native-combined-image', filename: combined.filename };
    }
  }

  downloadBlob(combined.blob, combined.filename);
  onToast?.('Front and back card image exported.');
  return { shared: true, method: 'download', filename: combined.filename };
}

export async function shareCard(card, { back = false, masterCards = [], onToast } = {}) {
  if (!card) return { shared: false, reason: 'no-card' };
  if (!isPublishedCard(card, masterCards)) {
    return shareCardAsImage(card, { onToast });
  }

  const url = buildCardShareUrl(card, { back, masterCards });
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: card.title, text: card.title, url });
      onToast?.('Card shared.');
      return { shared: true, method: 'native', url };
    } catch (err) {
      if (err?.name === 'AbortError') return { shared: false, reason: 'aborted', url };
    }
  }

  await copyTextToClipboard(url);
  onToast?.('Card link copied to clipboard.');
  return { shared: true, method: 'clipboard', url };
}
