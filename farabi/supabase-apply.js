(() => {
  const SUPABASE_URL = 'https://yhvfguhgbxinphcvbjax.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodmZndWhnYnhpbnBoY3ZiamF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQyMTEsImV4cCI6MjA3NDY2MDIxMX0.CVZQMcMcyl4o5saYcOgFheIhT51IHlTnAyerO3BR3sc';

  const pick = (form, patterns) => {
    const controls = [...form.querySelectorAll('input,select,textarea')];
    return controls.find(el => {
      const hay = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
      return patterns.some(p => hay.includes(p));
    });
  };

  const findForm = () => document.querySelector('form') || document.querySelector('.form');

  const init = () => {
    const form = findForm();
    if (!form || form.dataset.supabaseConnected === '1') return;
    form.dataset.supabaseConnected = '1';

    const controls = [...form.querySelectorAll('input,select,textarea')];
    const fallback = (index) => controls[index];
    const fields = {
      name: pick(form, ['name', 'নাম']) || fallback(0),
      phone: pick(form, ['phone', 'mobile', 'tel', 'মোবাইল', 'ফোন']) || fallback(1),
      email: pick(form, ['email', 'mail', 'ইমেইল']) || fallback(2),
      course: pick(form, ['course', 'subject', 'কোর্স']) || fallback(3),
      message: pick(form, ['message', 'details', 'note', 'মেসেজ', 'বিস্তারিত']) || fallback(4)
    };

    const status = form.querySelector('.status') || document.querySelector('.status');
    const submit = form.querySelector('button[type="submit"],button');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) { submit.disabled = true; submit.dataset.originalText = submit.textContent; submit.textContent = 'Sending…'; }
      if (status) status.textContent = 'আপনার আবেদন পাঠানো হচ্ছে…';

      const payload = {
        name: fields.name?.value?.trim() || '',
        phone: fields.phone?.value?.trim() || '',
        email: fields.email?.value?.trim() || null,
        course: fields.course?.value?.trim() || '',
        message: fields.message?.value?.trim() || null
      };

      if (!payload.name || !payload.phone || !payload.course) {
        if (status) status.textContent = 'দয়া করে নাম, ফোন এবং কোর্স পূরণ করুন।';
        if (submit) { submit.disabled = false; submit.textContent = submit.dataset.originalText || 'Apply'; }
        return;
      }

      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        if (status) status.textContent = 'আবেদন সফলভাবে জমা হয়েছে ✓';
        form.reset();
      } catch (error) {
        console.error('Supabase application submit failed:', error);
        if (status) status.textContent = 'আবেদন পাঠানো যায়নি। আবার চেষ্টা করুন।';
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = submit.dataset.originalText || 'Apply'; }
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
