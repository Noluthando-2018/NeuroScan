import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

/**
 * Loads every visit of a case (oldest → newest) plus, optionally,
 * the AI result of each visit keyed by visit id.
 *
 *   const { visits, results, loading, error, refresh } = useVisits(caseId);
 */
export function useVisits(caseId, { withResults = true } = {}) {
  const [visits, setVisits]   = useState([]);
  const [results, setResults] = useState({});
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*")
        .eq("case_id", caseId)
        .order("visit_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (cancelled) return;

      if (error) { setError(error.message); setVisits([]); setResults({}); setLoaded(true); return; }

      let resultMap = {};
      if (withResults && data?.length) {
        const { data: res } = await supabase
          .from("analysis_results")
          .select("visit_id, tumor_type, grade, prob_glioblastoma, prob_astrocytoma, prob_oligodendroglioma")
          .in("visit_id", data.map(v => v.id));
        resultMap = Object.fromEntries((res ?? []).map(r => [r.visit_id, r]));
      }
      if (cancelled) return;

      setError("");
      setVisits(data ?? []);
      setResults(resultMap);
      setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [caseId, withResults, tick]);

  return {
    visits:  caseId ? visits : [],
    results: caseId ? results : {},
    loading: caseId ? !loaded : false,
    error, refresh,
  };
}
