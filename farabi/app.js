const revealElements = document.querySelectorAll(".reveal");

// Keep observing elements so the reveal animation plays again when the user
// scrolls back through the page in either direction.
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const element = entry.target;

    if (entry.isIntersecting) {
      element.classList.add("visible", "show");
    } else {
      // Reset after leaving the viewport so the animation can replay.
      element.classList.remove("visible", "show");
    }
  });
}, {
  threshold: 0.12,
  rootMargin: "0px 0px -4% 0px"
});

revealElements.forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
  observer.observe(element);
});

// Scroll progress for the sticky navigation bar.
const updateScrollProgress = () => {
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = documentHeight > 0 ? Math.min(Math.max(window.scrollY / documentHeight, 0), 1) : 0;
  document.documentElement.style.setProperty("--scroll", progress);
};
updateScrollProgress();
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress, { passive: true });

document.getElementById("year").textContent = new Date().getFullYear();

const footer = document.querySelector(".footer");
if (footer && !footer.querySelector(".developer-contact")) {
  const contact = document.createElement("div");
  contact.className = "developer-contact";
  contact.innerHTML = `
    <span>Built by 𝐄𝐗𝐑 〆 𝐀𝐁𝐑𝐀𝐑</span><span>·</span>
    <a href="https://github.com/exu-coder-9x" target="_blank" rel="noopener noreferrer">GitHub</a><span>·</span>
    <a href="mailto:exucodex1@gmail.com">exucodex1@gmail.com</a>`;
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
const submitButton = form?.querySelector('button[type="submit"]');

const SUPABASE_URL = "https://yhvfguhgbxinphcvbjax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodmZndWhnYnhpbnBoY3ZiamF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODQyMTEsImV4cCI6MjA3NDY2MDIxMX0.CVZQMcMcyl4o5saYcOgFheIhTnAyerO3BR3sc";

if (form) form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(form).entries());
  if (!raw.name || !raw.phone || !raw.course) return;

  const originalText = submitButton?.textContent || "আবেদন করুন";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.remove("apply-success");
    submitButton.innerHTML = '<span class="apply-fill"></span><span class="apply-label">আবেদন জমা হচ্ছে…</span>';
  }
  statusBox.textContent = "আপনার আবেদন পাঠানো হচ্ছে…";
  statusBox.style.color = "#315b4b";

  const application = {
    full_name: String(raw.name).trim(),
    phone: String(raw.phone).trim(),
    email: raw.email ? String(raw.email).trim() : null,
    course: String(raw.course).trim(),
    message: [raw.address ? `ঠিকানা: ${String(raw.address).trim()}` : "", raw.message ? String(raw.message).trim() : ""].filter(Boolean).join("\n") || null
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

    if (submitButton) {
      submitButton.classList.add("apply-success");
      submitButton.innerHTML = '<span class="apply-check">✓</span><span class="apply-label">আবেদন সফল হয়েছে</span>';
    }
    statusBox.textContent = "আবেদন সফলভাবে জমা হয়েছে। আমাদের টিম আপনার সাথে যোগাযোগ করবে।";
    statusBox.style.color = "#0b6b45";
    form.reset();

    setTimeout(() => {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        submitButton.classList.remove("apply-success");
      }
    }, 2800);
  } catch (error) {
    console.error(error);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
    statusBox.textContent = "আবেদন জমা দিতে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    statusBox.style.color = "#b42318";
  }
});

const animationStyle = document.createElement("style");
animationStyle.textContent = `
.form button[type="submit"]{position:relative;overflow:hidden;transition:transform .25s ease,box-shadow .25s ease,background .35s ease}.form button[type="submit"]:disabled{cursor:wait;transform:scale(.985)}
.apply-fill{position:absolute;inset:0;width:0;background:linear-gradient(90deg,#b7d65c,#75b28b);opacity:.9;animation:applyFill 1.35s cubic-bezier(.2,.8,.2,1) forwards}.apply-label,.apply-check{position:relative;z-index:1}.apply-success{animation:applySuccess .55s ease both}.apply-check{display:inline-grid;place-items:center;width:25px;height:25px;margin-right:7px;border-radius:50%;background:#fff;color:#0b6b45;font-weight:900;animation:checkPop .45s cubic-bezier(.2,1.5,.4,1) both}@keyframes applyFill{from{width:0}to{width:100%}}@keyframes applySuccess{0%{transform:scale(.97)}60%{transform:scale(1.025)}100%{transform:scale(1)}}@keyframes checkPop{from{transform:scale(0) rotate(-45deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
`;
document.head.appendChild(animationStyle);
