// Hook générique pour les listes paginées + recherche côté serveur.
import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

export function usePaginatedResource(url, params = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [parPage, setParPage] = useState(10);
  const [search, setSearch] = useState('');
  const [enChargement, setEnChargement] = useState(true);
  const [rechargerCle, setRechargerCle] = useState(0);
  const paramsCle = JSON.stringify(params);

  const recharger = useCallback(() => setRechargerCle((c) => c + 1), []);

  useEffect(() => {
    let actif = true;
    setEnChargement(true);
    const query = new URLSearchParams({ page: String(page), parPage: String(parPage), ...(search ? { search } : {}), ...JSON.parse(paramsCle) });
    api.get(`${url}?${query.toString()}`)
      .then(({ data }) => {
        if (!actif) return;
        setItems(data.rows || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        if (!actif) return;
        setItems([]);
        setTotal(0);
      })
      .finally(() => actif && setEnChargement(false));
    return () => { actif = false; };
  }, [url, page, parPage, search, rechargerCle, paramsCle]);

  useEffect(() => { setPage(1); }, [search, paramsCle]);

  return {
    items, total, page, parPage, search, enChargement,
    setPage, setParPage, setSearch, recharger,
    totalPages: Math.max(1, Math.ceil(total / parPage)),
  };
}
