const SUPABASE_URL = window.FARABI_SUPABASE_URL || 'https://yhvfguhgbxinphcvbjax.supabase.co';
const SUPABASE_ANON_KEY = window.FARABI_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodmZndWhnYnhpbnBoY3ZiamF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQyMTEsImV4cCI6MjA3NDY2MDIxMX0.CVZQMcMcyl4o5saYcOgFheIhTnAyerO3BR3sc';

const form = document.getElementById('applicationForm');
const statusEl = document.getElementById('status');

function setStatus(message, ok = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = ok ? '#15803d' : '#b45309';
}

async function submitApplication(data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(data)
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.message || json.hint || json.details || json.error || text;
    } catch (_) {}
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }

  return text ? JSON.parse(text) : [];
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setStatus('আবেদন জমা দেওয়া হচ্ছে…');

    const raw = Object.fromEntries(new FormData(form));
    const data = {
      full_name: String(raw.full_name || '').trim(),
      phone: String(raw.phone || '').trim(),
      email: raw.email ? String(raw.email).trim() : null,
      course: String(raw.course || '').trim(),
      message: raw.message ? String(raw.message).trim() : null
    };

    try {
      const saved = await submitApplication(data);
      console.log('Farabi application saved to Supabase:', saved);
      localStorage.removeItem('farabi_pending_application');
      setStatus('আবেদন সফলভাবে জমা হয়েছে ✓', true);
      form.reset();
    } catch (error) {
      console.error('Farabi Supabase insert failed:', error);
      localStorage.setItem('farabi_pending_application', JSON.stringify({
        ...data,
        created_at: new Date().toISOString(),
        error: String(error.message || error)
      }));
      setStatus('Supabase-এ সংযোগ/সংরক্ষণে সমস্যা হয়েছে। আবেদনটি সাময়িকভাবে সংরক্ষণ করা হয়েছে।');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
