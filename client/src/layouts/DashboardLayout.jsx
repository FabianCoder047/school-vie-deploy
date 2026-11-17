// Layout principal : Sidebar fixe (100vh) + Topbar (logo, « Espace … »,
// cloche avec badge RÉEL + panneau déroulant, déconnexion) + contenu.
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import api from '../api/axios';
import { SIDEBAR_MENUS } from './sidebarMenu';
import { ROLE_ESPACE } from '../routes/roleRoutes';
import { IconBell, IconLogout } from './sidebarIcons';
import Badge from '../components/Badge';
import logo from '../assets/logo.svg';

const TYPE_LIB = { COMMUNIQUE: 'Communiqué', SCOLARITE: 'Scolarité', RELANCE: 'Relance', ABSENCE: 'Absence', RETARD: 'Retard', PRESENCE: 'Présence', SYSTEME: 'Système' };
const TYPE_COULEUR = { COMMUNIQUE: 'bleu', SCOLARITE: 'vert', RELANCE: 'jaune', ABSENCE: 'rouge', RETARD: 'jaune', PRESENCE: 'vert', SYSTEME: 'gris' };

export default function DashboardLayout() {
  const { user, deconnexion } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [nonLues, setNonLues] = useState(0);
  const [pageNotifs, setPageNotifs] = useState(1);
  const [chargementNotifs, setChargementNotifs] = useState(false);
  const [plusDisponibles, setPlusDisponibles] = useState(false);
  const panneauRef = useRef(null);
  const barreRef = useRef(null);
  const coquilleRef = useRef(null);

  const menu = SIDEBAR_MENUS[user?.role] || [];

  const chargerNotifications = useCallback(async (page = 1, append = false) => {
    setChargementNotifs(true);
    try {
      const [{ data }, { data: compteur }] = await Promise.all([
        api.get(`/notifications?page=${page}&parPage=15`),
        api.get('/notifications/non-lues/count'),
      ]);
      setNotifications((prev) => (append ? [...prev, ...(data.rows || [])] : (data.rows || [])));
      setNonLues(compteur.nonLues || 0);
      setPageNotifs(page);
      setPlusDisponibles((data.rows?.length || 0) === 15 && (data.total || 0) > page * 15);
    } catch {
      /* badge reste à sa valeur courante */
    } finally {
      setChargementNotifs(false);
    }
  }, []);

  // Premier chargement + rafraîchissement périodique (30 s)
  useEffect(() => {
    chargerNotifications(1, false);
    const intervalle = window.setInterval(() => chargerNotifications(1, false), 30_000);
    return () => window.clearInterval(intervalle);
  }, [chargerNotifications]);

  // Barre d'onglets mobile/tablette : mesurer sa hauteur (elle dépend du
  // nombre d'items du rôle) pour éviter que le contenu passe dessous.
  useEffect(() => {
    const barre = barreRef.current;
    const coquille = coquilleRef.current;
    if (!barre || !coquille) return undefined;
    const maj = () => coquille.style.setProperty('--hauteur-barre-basse', `${barre.offsetHeight}px`);
    maj();
    const observateur = new ResizeObserver(maj);
    observateur.observe(barre);
    window.addEventListener('resize', maj);
    return () => {
      observateur.disconnect();
      window.removeEventListener('resize', maj);
    };
  }, [menu.length]);

  // Fermer le panneau de notifications au clic extérieur / Échap.
  useEffect(() => {
    if (!panneauOuvert) return undefined;
    const onDocClick = (e) => {
      if (!panneauRef.current?.contains(e.target)) setPanneauOuvert(false);
    };
    const onKey = (e) => e.key === 'Escape' && setPanneauOuvert(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [panneauOuvert]);

  const handleDeconnexion = async () => {
    await deconnexion();
    toast.info('Vous êtes déconnecté.');
    navigate('/connexion', { replace: true });
  };

  const marquerLue = async (notif) => {
    if (notif.read_at) return;
    try {
      await api.post(`/notifications/${notif.id}/lue`);
      setNotifications((liste) => liste.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)));
      setNonLues((n) => Math.max(0, n - 1));
    } catch { /* silencieux */ }
  };

  const toutMarquerLu = async () => {
    try {
      await api.post('/notifications/tout-lire');
      setNotifications((liste) => liste.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setNonLues(0);
      toast.succes('Toutes les notifications sont marquées comme lues.');
    } catch {
      toast.erreur('Action impossible.');
    }
  };

  return (
    <div className="app-shell" ref={coquilleRef}>
      {/* ===== Sidebar (fixe sur bureau, barre d'onglets en bas sur mobile/tablette) ===== */}
      <aside className="sidebar" aria-label="Navigation principale" ref={barreRef}>
        <div className="sidebar-logo">
          <img src={logo} alt="Logo de l'établissement" />
          <div>
            <div className="sidebar-logo-nom">School Vie</div>
            <div className="sidebar-logo-sous">Gestion d’établissement</div>
          </div>
        </div>
        <nav className="sidebar-menu">
          {menu.map((item, index) =>
            item.section ? (
              <div key={`section-${index}`} className="sidebar-section">{item.section}</div>
            ) : (
              <NavLink
                key={item.label}
                end
                to={item.sprint ? `/en-construction?titre=${encodeURIComponent(item.label)}&sprint=${encodeURIComponent(item.sprint)}` : item.to}
                className={({ isActive }) => `sidebar-item ${isActive && !item.sprint ? 'actif' : ''}`}
              >
                <item.icone />
                <span>{item.label}</span>
                {item.sprint && <span className="bientot">{item.sprint.replace('Sprint ', 'S')}</span>}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      {/* ===== Zone principale ===== */}
      <div className="zone-principale">
        <header className="topbar">
          <div className="topbar-espace">
            <img src={logo} alt="" aria-hidden="true" />
            <span>{ROLE_ESPACE[user?.role] || 'Espace'}</span>
          </div>
          <div className="topbar-droite" ref={panneauRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="cloche-bouton"
              onClick={() => setPanneauOuvert((v) => !v)}
              aria-label={`Notifications${nonLues ? `, ${nonLues} non lues` : ''}`}
              aria-expanded={panneauOuvert}
            >
              <IconBell />
              {nonLues > 0 && <span className="cloche-badge">{nonLues > 99 ? '99+' : nonLues}</span>}
            </button>
            <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.prenom} {user?.nom}</div>
              <div style={{ fontSize: 11, color: 'var(--gris-500)' }}>{user?.email || user?.telephone}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeconnexion}>
              <IconLogout />
              <span>Déconnexion</span>
            </button>

            {/* Panneau de notifications (données réelles) */}
            {panneauOuvert && (
              <div className="cloche-panneau" role="dialog" aria-label="Notifications">
                <div className="cloche-panneau-header">
                  <span>Notifications</span>
                  <div className="flex gap-2" style={{ alignItems: 'center' }}>
                    <span className="badge badge-bleu">{nonLues} non lue{nonLues > 1 ? 's' : ''}</span>
                    {nonLues > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={toutMarquerLu}>Tout marquer lu</button>}
                  </div>
                </div>
                {chargementNotifs && notifications.length === 0 ? (
                  <div className="spinner" style={{ margin: '16px auto' }} />
                ) : notifications.length === 0 ? (
                  <div className="etat-vide" style={{ padding: '32px 16px' }}>
                    Aucune notification pour le moment.
                  </div>
                ) : (
                  <>
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`notif-item ${n.read_at ? '' : 'non-lue'}`}
                        onClick={() => marquerLue(n)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}
                      >
                        <div className="notif-item-titre">
                          <Badge couleur={TYPE_COULEUR[n.type] || 'gris'}>{TYPE_LIB[n.type] || n.type}</Badge>
                          <span style={{ marginLeft: 8 }}>{n.titre}</span>
                        </div>
                        <div className="notif-item-message">{n.message}</div>
                        <div className="notif-item-date">{new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      </button>
                    ))}
                    {plusDisponibles && (
                      <div style={{ padding: '8px', textAlign: 'center' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => chargerNotifications(pageNotifs + 1, true)} disabled={chargementNotifs}>
                          {chargementNotifs ? 'Chargement…' : 'Charger plus'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="contenu">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
