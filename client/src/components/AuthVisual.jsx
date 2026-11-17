// Visuel d'illustration animé (SVG) de l'école School Vie.
// Utilisé dans les pages d'authentification (connexion, mot de passe, …).
export default function AuthVisual() {
  return (
    <aside className="auth-visuel" aria-hidden="true">
      {/* Scène animée : soleil, nuages, oiseaux, école, arbres, scintillements */}
      <svg className="auth-scene" viewBox="0 0 460 560" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6db6ff"/>
            <stop offset="0.42" stopColor="#a9d8ff"/>
            <stop offset="0.78" stopColor="#dff1ff"/>
            <stop offset="1" stopColor="#fdf3d8"/>
          </linearGradient>
          <radialGradient id="soleil" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6c4"/>
            <stop offset="0.6" stopColor="#ffd60a"/>
            <stop offset="1" stopColor="#ffb703"/>
          </radialGradient>
          <linearGradient id="mur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffdf4"/>
            <stop offset="1" stopColor="#f7ecd4"/>
          </linearGradient>
          <linearGradient id="murCentre" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff"/>
            <stop offset="1" stopColor="#efe0c4"/>
          </linearGradient>
          <linearGradient id="toit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f5bd7"/>
            <stop offset="1" stopColor="#1e3a8a"/>
          </linearGradient>
          <linearGradient id="dome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd84d"/>
            <stop offset="1" stopColor="#e0a107"/>
          </linearGradient>
          <linearGradient id="porte" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#274690"/>
            <stop offset="1" stopColor="#16294f"/>
          </linearGradient>
          <linearGradient id="collineFond" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5dbb7d"/>
            <stop offset="1" stopColor="#3f9e5e"/>
          </linearGradient>
          <linearGradient id="collineAvant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#49a862"/>
            <stop offset="1" stopColor="#2c7a43"/>
          </linearGradient>
        </defs>

        {/* Ciel */}
        <rect x="0" y="0" width="460" height="560" fill="url(#ciel)"/>

        {/* Soleil + rayons tournants */}
        <g className="auth-soleil-rayons" stroke="#ffd60a" strokeWidth="5" strokeLinecap="round" opacity="0.9">
          <line x1="378" y1="6" x2="378" y2="18"/>
          <line x1="378" y1="138" x2="378" y2="150"/>
          <line x1="306" y1="78" x2="318" y2="78"/>
          <line x1="438" y1="78" x2="450" y2="78"/>
          <line x1="327" y1="27" x2="336" y2="36"/>
          <line x1="420" y1="120" x2="429" y2="129"/>
          <line x1="429" y1="27" x2="420" y2="36"/>
          <line x1="336" y1="120" x2="327" y2="129"/>
        </g>
        <circle cx="378" cy="78" r="34" fill="url(#soleil)"/>

        {/* Nuages dérivant */}
        <g className="auth-nuage auth-nuage-1" fill="#ffffff" opacity="0.97">
          <ellipse cx="70" cy="118" rx="24" ry="13"/>
          <ellipse cx="92" cy="110" rx="20" ry="12"/>
          <ellipse cx="114" cy="120" rx="22" ry="12"/>
        </g>
        <g className="auth-nuage auth-nuage-2" fill="#ffffff" opacity="0.9">
          <ellipse cx="200" cy="52" rx="17" ry="9"/>
          <ellipse cx="216" cy="46" rx="14" ry="9"/>
          <ellipse cx="231" cy="53" rx="15" ry="8"/>
        </g>
        <g className="auth-nuage auth-nuage-3" fill="#ffffff" opacity="0.85">
          <ellipse cx="330" cy="168" rx="19" ry="10"/>
          <ellipse cx="350" cy="161" rx="15" ry="9"/>
          <ellipse cx="368" cy="169" rx="16" ry="8"/>
        </g>

        {/* Oiseaux */}
        <path className="auth-oiseau auth-oiseau-1" d="M118 84 q7 -7 14 0 q7 -7 14 0" fill="none" stroke="#16294f" strokeWidth="2" strokeLinecap="round"/>
        <path className="auth-oiseau auth-oiseau-2" d="M196 132 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#16294f" strokeWidth="1.8" strokeLinecap="round"/>

        {/* Collines */}
        <path d="M0 428 Q110 396 235 424 T460 418 V560 H0 Z" fill="url(#collineFond)"/>
        <path d="M0 470 Q150 442 300 468 T460 462 V560 H0 Z" fill="url(#collineAvant)"/>

        {/* Chemin vers l'école */}
        <path d="M213 442 L247 442 L272 560 L188 560 Z" fill="#ecdfc2"/>
        <line x1="230" y1="452" x2="230" y2="556" stroke="#d6c7a1" strokeWidth="2.5" strokeDasharray="7 9"/>

        {/* ===== ÉCOLE ===== */}
        {/* Ailes latérales */}
        <rect x="66" y="302" width="112" height="142" fill="url(#mur)" stroke="#d9c9a3" strokeWidth="1.5"/>
        <rect x="282" y="302" width="112" height="142" fill="url(#mur)" stroke="#d9c9a3" strokeWidth="1.5"/>
        <path d="M60 302 L122 266 L184 302 Z" fill="url(#toit)"/>
        <path d="M276 302 L338 266 L400 302 Z" fill="url(#toit)"/>

        {/* Corps central */}
        <rect x="152" y="246" width="156" height="198" fill="url(#murCentre)" stroke="#d9c9a3" strokeWidth="1.5"/>
        <path d="M140 246 L230 176 L320 246 Z" fill="url(#toit)"/>
        {/* Clocheton + dôme + mât + drapeau */}
        <rect x="212" y="150" width="36" height="34" fill="#fdf6e3" stroke="#d9c9a3" strokeWidth="1.5"/>
        <path d="M206 150 Q230 120 254 150 Z" fill="url(#dome)"/>
        <circle cx="230" cy="122" r="3.4" fill="#e0a107"/>
        <line x1="230" y1="120" x2="230" y2="96" stroke="#475569" strokeWidth="2.4"/>
        <path className="auth-drapeau" d="M230 97 L256 103 L230 110 Z" fill="#e03224"/>

        {/* Enseigne */}
        <rect x="166" y="256" width="128" height="17" rx="4" fill="#1e3a8a"/>
        <text x="230" y="268" textAnchor="middle" fontSize="9" fontWeight="800" fill="#ffd84d" letterSpacing="1.6" fontFamily="'Segoe UI',Arial,sans-serif">SCHOOL VIE</text>

        {/* Fenêtres ailes */}
        <g stroke="#1e40af" strokeWidth="2" fill="#dbeafe">
          <rect x="88" y="330" width="27" height="24" rx="3"/>
          <rect x="131" y="330" width="27" height="24" rx="3"/>
          <rect x="88" y="386" width="27" height="24" rx="3"/>
          <rect x="131" y="386" width="27" height="24" rx="3"/>
          <rect x="302" y="330" width="27" height="24" rx="3"/>
          <rect x="345" y="330" width="27" height="24" rx="3"/>
          <rect x="302" y="386" width="27" height="24" rx="3"/>
          <rect x="345" y="386" width="27" height="24" rx="3"/>
        </g>
        {/* Fenêtres allumées (pulsation) */}
        <rect className="auth-fenetre-allumee" x="302" y="386" width="27" height="24" rx="3" fill="#ffe98a" stroke="#e0a107" strokeWidth="2"/>
        <rect className="auth-fenetre-allumee auth-fenetre-allumee-2" x="88" y="330" width="27" height="24" rx="3" fill="#ffe98a" stroke="#e0a107" strokeWidth="2"/>

        {/* Fenêtres corps central */}
        <g stroke="#1e40af" strokeWidth="2" fill="#dbeafe">
          <rect x="168" y="322" width="26" height="23" rx="3"/>
          <rect x="266" y="322" width="26" height="23" rx="3"/>
        </g>

        {/* Porte arquée + marches */}
        <path d="M211 444 V382 a19 15 0 0 1 38 0 V444 Z" fill="url(#porte)" stroke="#16294f" strokeWidth="1.5"/>
        <circle cx="242" cy="412" r="2" fill="#ffd84d"/>
        <rect x="202" y="444" width="56" height="6" fill="#d9c9a3"/>
        <rect x="196" y="450" width="68" height="6" fill="#c9b88c"/>

        {/* ===== Arbres ===== */}
        <rect x="30" y="382" width="10" height="86" fill="#7a4a21"/>
        <g className="auth-arbre">
          <circle cx="35" cy="352" r="24" fill="#2f8f4e"/>
          <circle cx="15" cy="375" r="15" fill="#37985a"/>
          <circle cx="55" cy="375" r="15" fill="#37985a"/>
          <circle cx="26" cy="343" r="7" fill="#57b06f" opacity="0.9"/>
        </g>
        <rect x="419" y="392" width="8" height="76" fill="#7a4a21"/>
        <g className="auth-arbre auth-arbre-2">
          <circle cx="423" cy="368" r="18" fill="#2f8f4e"/>
          <circle cx="407" cy="387" r="12" fill="#37985a"/>
          <circle cx="439" cy="387" r="12" fill="#37985a"/>
        </g>

        {/* Buissons + fleurs */}
        <ellipse cx="150" cy="452" rx="18" ry="9" fill="#2f8f4e"/>
        <ellipse cx="310" cy="452" rx="18" ry="9" fill="#2f8f4e"/>
        <g className="auth-scintille"><circle cx="120" cy="496" r="2.6" fill="#ffd84d"/></g>
        <g className="auth-scintille auth-scintille-2"><circle cx="345" cy="512" r="2.6" fill="#ff8fb3"/></g>
        <g className="auth-scintille auth-scintille-3"><circle cx="255" cy="500" r="2.2" fill="#ffffff"/></g>
        <g className="auth-scintille auth-scintille-2"><circle cx="70" cy="530" r="2.4" fill="#ff8fb3"/></g>

        {/* Scintillements dans le ciel */}
        <path className="auth-scintille auth-scintille-3" d="M150 60 l2.4 5.4 5.4 2.4 -5.4 2.4 -2.4 5.4 -2.4 -5.4 -5.4 -2.4 5.4 -2.4 Z" fill="#ffffff"/>
        <path className="auth-scintille auth-scintille-2" d="M268 96 l1.9 4.2 4.2 1.9 -4.2 1.9 -1.9 4.2 -1.9 -4.2 -4.2 -1.9 4.2 -1.9 Z" fill="#ffffff"/>
      </svg>

      {/* Texte de présentation en surimpression */}
      <div className="auth-visuel-texte">
        <span className="auth-visuel-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26 6.6.57-5 4.4 1.5 6.37L12 16.9 5.99 19.6l1.5-6.37-5-4.4 6.6-.57L12 2z"/></svg>
          Établissement scolaire
        </span>
        <h2 className="auth-visuel-titre">Bienvenue à <span>School Vie</span></h2>
        <p className="auth-visuel-sous-titre">Notes, absences, bulletins et paiements réunis en un seul espace — pour les élèves, les parents et les équipes.</p>
      </div>
    </aside>
  );
}
