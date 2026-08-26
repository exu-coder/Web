const form = document.getElementById('applicationForm');
const statusEl = document.getElementById('status');

function setStatus(message, ok = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = ok ? '#15803d' : '#b45309';
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
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
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'আবেদন সংরক্ষণ করা যায়নি');
      localStorage.removeItem('farabi_pending_application');
      setStatus('আবেদন সফলভাবে জমা হয়েছে ✓', true);
      form.reset();
    } catch (error) {
      console.error('Local database insert failed:', error);
      localStorage.setItem('farabi_pending_application', JSON.stringify({ ...data, created_at: new Date().toISOString() }));
      setStatus('সার্ভারে সংযোগ সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।');
    } finally {
      if (button) button.disabled = false;
    }
  });
}
