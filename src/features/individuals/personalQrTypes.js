import { useEffect, useState } from 'react';
import { manufacturingApi } from '../../api/supabaseClient.js';

export function usePersonalQrTypes() {
  const [types, setTypes] = useState([]);
  const [typeError, setTypeError] = useState('');
  useEffect(() => {
    let active = true;
    manufacturingApi.rpc('app_personal_qr_types').then(rows => {
      if (active) setTypes(rows);
    }).catch(error => { if (active) setTypeError(error.message); });
    return () => { active = false; };
  }, []);
  return { types, typeError };
}

export function personalCards(type, people, issue, replace = false) {
  return type
    ? manufacturingApi.rpc('app_attendance_cards', { p_type: type, p_people: people, p_issue: issue, p_replace: replace })
    : manufacturingApi.rpc('app_individual_qr_cards', { p_people: people, p_issue: issue });
}
