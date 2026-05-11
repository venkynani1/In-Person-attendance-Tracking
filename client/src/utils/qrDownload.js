function safeFileName(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'training';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('QR image could not be loaded.'));
    image.src = src;
  });
}

function wrapText(context, text, maxWidth) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth || !currentLine) {
      currentLine = testLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
}

export async function downloadQrAsJpg({ qrSrc, trainingName }) {
  if (!qrSrc) {
    throw new Error('QR code is still loading.');
  }

  const image = await loadImage(qrSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Your browser could not prepare the QR download.');
  }

  const canvasWidth = 1200;
  const padding = 96;
  const qrSize = 860;
  const title = trainingName || 'Training QR Code';

  canvas.width = canvasWidth;
  canvas.height = 1260;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#0f172a';
  context.font = '700 48px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';

  const titleLines = wrapText(context, title, canvasWidth - padding * 2);
  titleLines.forEach((line, index) => {
    context.fillText(line, canvasWidth / 2, 60 + index * 58);
  });

  const titleBlockHeight = titleLines.length * 58;
  const qrTop = 80 + titleBlockHeight;
  context.drawImage(image, (canvasWidth - qrSize) / 2, qrTop, qrSize, qrSize);

  context.fillStyle = '#475569';
  context.font = '600 30px Arial, sans-serif';
  context.fillText('Scan to mark attendance', canvasWidth / 2, qrTop + qrSize + 42);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.download = `${safeFileName(title)}-qr.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
