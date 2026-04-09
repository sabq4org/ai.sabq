import Link from 'next/link';

/**
 * Footer Component - Sabq News
 * 
 * Dark footer with links, social media, and copyright.
 * Matches the editorial design system.
 */

const footerLinks = {
  about: [
    { label: 'من نحن', href: '/about' },
    { label: 'اتصل بنا', href: '/contact' },
    { label: 'سياسة الخصوصية', href: '/privacy' },
    { label: 'الشروط والأحكام', href: '/terms' },
  ],
  sections: [
    { label: 'أخبار السعودية', href: '/category/saudi' },
    { label: 'أخبار العالم', href: '/category/world' },
    { label: 'رياضة', href: '/category/sports' },
    { label: 'اقتصاد', href: '/category/economy' },
    { label: 'تقنية', href: '/category/tech' },
    { label: 'ثقافة وفن', href: '/category/culture' },
  ],
  services: [
    { label: 'النشرات الصوتية', href: '/podcasts' },
    { label: 'كتّاب الرأي', href: '/opinion' },
    { label: 'مقترب', href: '/muqtarab' },
    { label: 'الناشرون', href: '/publishers' },
  ],
};

const socialLinks = [
  { label: 'X (تويتر)', href: 'https://twitter.com/sababorgsabq', icon: 'X' },
  { label: 'يوتيوب', href: 'https://youtube.com/@sabq', icon: 'YT' },
  { label: 'إنستغرام', href: 'https://instagram.com/sabq', icon: 'IG' },
  { label: 'فيسبوك', href: 'https://facebook.com/sabq', icon: 'FB' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0D0D0D] text-white/80 mt-auto">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 py-12">
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <span className="text-white text-3xl font-extrabold" style={{ fontFamily: "'Cairo', sans-serif" }}>
                سبق
              </span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed mb-4">
              صحيفة سبق الإلكترونية - مصدرك الأول للأخبار في المملكة العربية السعودية والعالم.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white/70 hover:bg-[#C0392B] hover:text-white transition-colors"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* About Links */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">عن سبق</h3>
            <ul className="space-y-2">
              {footerLinks.about.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 hover:text-[#C0392B] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sections */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">الأقسام</h3>
            <ul className="space-y-2">
              {footerLinks.sections.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 hover:text-[#C0392B] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">خدماتنا</h3>
            <ul className="space-y-2">
              {footerLinks.services.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 hover:text-[#C0392B] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            جميع الحقوق محفوظة لصحيفة سبق الإلكترونية {currentYear} &copy;
          </p>
          <p className="text-xs text-white/40">
            ترخيص وزارة الإعلام رقم: 1234
          </p>
        </div>
      </div>
    </footer>
  );
}
