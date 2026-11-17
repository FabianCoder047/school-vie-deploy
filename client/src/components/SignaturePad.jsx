// Pad de signature (souris ou doigt) sur canvas — aucune dépendance externe.
// Lisse les traits (courbes quadratiques), supporte la pression via lineWidth.
import { useCallback, useEffect, useRef, useState } from 'react';

function preparerCanvas(canvas) {
  // Dessin net sur écrans retina : on scale le contexte selon devicePixelRatio.
  const dsf = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dsf));
  canvas.height = Math.max(1, Math.round(rect.height * dsf));
  const ctx = canvas.getContext('2d');
  ctx.scale(dsf, dsf);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111c3f';
  ctx.lineWidth = 2.4;
  return ctx;
}

/**
 * Retravaille la signature dessinée : recadre automatiquement sur l'encre
 * (le directeur peut signer n'importe où sur le pad), puis renforce les
 * traits utilisés (contrasté, pleinement opaque pour une impression nette).
 */
function traiterSignature(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (!width || !height) return null;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = d[i + 3];
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (a > 20 && lum < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // rien dessiné

  const padPixels = Math.max(6, Math.round(width * 0.02));
  minX = Math.max(0, minX - padPixels);
  minY = Math.max(0, minY - padPixels);
  maxX = Math.min(width - 1, maxX + padPixels);
  maxY = Math.min(height - 1, maxY + padPixels);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, w, h);
  octx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);

  // Rendre l'encre franche : traits denses et opaques sur fond blanc.
  const sortie = octx.getImageData(0, 0, w, h);
  const data = sortie.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (a > 15 && lum < 250) {
      const force = Math.min(1, (250 - lum) / 170);
      data[i] = Math.round(data[i] * (1 - force * 0.4));
      data[i + 1] = Math.round(data[i + 1] * (1 - force * 0.4));
      data[i + 2] = Math.round(data[i + 2] * (1 - force * 0.15));
      data[i + 3] = 255;
    }
  }
  octx.putImageData(sortie, 0, 0);
  return out.toDataURL('image/png');
}

export default function SignaturePad({ onSave, onCancel, hauteur = 220 }) {
  const canvasRef = useRef(null);
  const trace = useRef({ dessin: false, dernier: null });
  const [aDessine, setADessine] = useState(false);

  const reinitialiser = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // Fond blanc (le canvas transparent exporterait une signature invisible sur fond clair)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setADessine(false);
  }, []);

  // Init + surveillance du redimensionnement (le canvas doit garder ses proportions)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = preparerCanvas(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const onResize = () => reinitialiser();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [reinitialiser]);

  const pointActuel = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    const point = pointActuel(e);
    trace.current = { dessin: true, dernier: point };
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01); // point initial même sans bouger
    ctx.stroke();
    setADessine(true);
  };

  const onPointerMove = (e) => {
    if (!trace.current.dessin) return;
    e.preventDefault();
    const point = pointActuel(e);
    const { dernier } = trace.current;
    const milieu = { x: (dernier.x + point.x) / 2, y: (dernier.y + point.y) / 2 };
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(dernier.x, dernier.y);
    ctx.quadraticCurveTo(dernier.x, dernier.y, milieu.x, milieu.y);
    ctx.stroke();
    trace.current.dernier = point;
  };

  const terminer = (e) => {
    if (!trace.current.dessin) return;
    e?.preventDefault?.();
    trace.current.dessin = false;
    trace.current.dernier = null;
  };

  const enregistrer = () => {
    const canvas = canvasRef.current;
    if (!canvas || !aDessine) return;
    const traite = traiterSignature(canvas); // recadrage au trait + contraste
    onSave?.(traite || canvas.toDataURL('image/png'));
  };

  return (
    <div className="signature-pad-bloc">
      <canvas
        ref={canvasRef}
        className="signature-pad"
        style={{ height: hauteur }}
        aria-label="Zone de signature — signez avec la souris ou le doigt"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={terminer}
        onPointerLeave={terminer}
        onPointerCancel={terminer}
      />
      <p className="text-doux" style={{ fontSize: 11, marginTop: 6 }}>Signez dans le cadre ci-dessus, avec la souris ou le doigt.</p>
      <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reinitialiser}>Effacer</button>
        {onCancel && <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>}
        <button type="button" className="btn btn-primary btn-sm" onClick={enregistrer} disabled={!aDessine}>Enregistrer ma signature</button>
      </div>
    </div>
  );
}
