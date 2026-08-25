const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

document.getElementById("year").textContent = new Date().getFullYear();

const footer = document.querySelector(".footer");
if (footer && !footer.querySelector(".developer-contact")) {
  const contact = document.createElement("div");
  contact.className = "developer-contact";
  contact.innerHTML = `
    <span>Built by 𝐄𝐗𝐑 〆 𝐀𝐁𝐑𝐀𝐑</span>
    <span>·</span>
    <a href="https://github.com/exu-coder-9x" target="_blank" rel="noopener noreferrer">GitHub</a>
    <span>·</span>
    <a href="mailto:exucodex1@gmail.com">exucodex1@gmail.com</a>
  `;
  contact.style.cssText = "width:100%;margin-top:18px;padding-top:16px;border-top:1px solid #ffffff18;text-align:center;font:600 12px 'Space Grotesk',sans-serif;letter-spacing:.03em;color:#aebfb7";
  contact.querySelectorAll("a").forEach(link => {
    link.style.color = "#d7ee8b";
    link.style.textDecoration = "none";
    link.addEventListener("mouseenter", () => link.style.textDecoration = "underline");
    link.addEventListener("mouseleave", () => link.style.textDecoration = "none");
  });
  footer.appendChild(contact);
}

const form = document.getElementById("applicationForm");
const statusBox = document.getElementById("formStatus");

const SUPABASE_URL = "https://yhvfguhgbxinphcvbjax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodmZndWhnYnhpbnBoY3ZiamF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQyMTEsImV4cCI6MjA3NDY2MDIxMX0.CVZQMcMcyl4o5saYcOgFheIhT51IHlTnAyerO3BR3sc";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(form).entries());
  statusBox.textContent = "আবেদন জমা দেওয়া হচ্ছে…";
  statusBox.style.color = "#315b4b";

  const application = {
    full_name: raw.name,
    phone: raw.phone,
    email: raw.email || null,
    course: raw.course,
    message: [raw.address ? `ঠিকানা: ${raw.address}` : "", raw.message || ""].filter(Boolean).join("\n") || null
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(application)
    });

    if (!response.ok) throw new Error(await response.text());

    statusBox.textContent = "আবেদন সফলভাবে জমা হয়েছে। আমাদের টিম আপনার সাথে যোগাযোগ করবে।";
    statusBox.style.color = "#0b6b45";
    form.reset();
  } catch (error) {
    console.error(error);
    statusBox.textContent = "আবেদন জমা দিতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    statusBox.style.color = "#b42318";
  }
});
