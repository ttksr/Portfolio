// FR / EN for the page's own texts (content lives in assets/data/content.js).
// Markup: data-i18n="key" sets the text, data-i18n-attr="aria-label:key;title:key" sets attributes,
// data-i18n-rich="key" understands [[…]] as a redacted highlight. No innerHTML: text nodes only.

(() => {
    const root = document.documentElement;

    const STRINGS = {
        en: {
            'meta.description': 'Matteo Scaringella — cybersecurity student at Ynov. Penetration testing, ethical hacking, CTF writeups and infrastructure security.',
            'nav.about': 'About',
            'nav.projects': 'Projects',
            'nav.writeups': 'Writeups',
            'nav.certs': 'Certifications',
            'nav.lab': 'Lab',
            'nav.contact': 'Contact',
            'aria.home': 'Home',
            'aria.theme': 'Toggle dark / light mode',
            'aria.lang': 'Passer le site en français',
            'aria.menu': 'Open menu',
            'aria.menuClose': 'Close menu',
            'aria.terminal': 'Open terminal (T)',
            'aria.sections': 'Sections',
            'hero.eyebrow': 'Cybersecurity student · Ynov',
            'hero.hello': 'Hi, I’m',
            'hero.desc': 'Penetration testing first: I look for the flaws in systems before attackers do — and help secure the infrastructures behind them.',
            'hero.projects': 'View projects',
            'hero.contact': 'Get in touch',
            'about.title': 'About me',
            'about.p1': 'I’m a passionate cybersecurity student at Ynov, driven by curiosity about how systems work — and how to [[break them to make them better]].',
            'about.p2': 'My journey involves exploring [[ethical hacking]], securing [[network infrastructures]] and developing tools to [[automate security tasks]]. I thrive on challenges and keep learning about the latest threats and defense mechanisms.',
            'about.focus': 'Focus areas',
            'focus.offense': 'Ethical hacking & pentesting',
            'focus.network': 'Infrastructure hardening',
            'focus.tooling': 'Security automation',
            'focus.crypto': 'Encryption & secure messaging',
            'projects.title': 'Projects',
            'writeups.title': 'Writeups',
            'writeups.lead': 'CTF and lab writeups: how a target fell, and what a defender should fix.',
            'writeups.all': 'all',
            'writeups.empty': 'No writeup in this category yet.',
            'certs.title': 'Certifications',
            'certs.lead': 'What’s obtained, what’s in progress, and what’s next.',
            'certs.education': 'Education',
            'certs.certs': 'Certifications',
            'lab.title': 'HD 110067',
            'lab.eyebrow': 'Lab · side project',
            'lab.lead': 'A rendering engine written from scratch (no library) that computes the published ephemerides of six real exoplanets, live. Click a body, or drag around the system to turn time.',
            'contact.title': 'Contact',
            'contact.lead': 'Also up for joining a CTF team or simply talking security. Write to me — encrypted with my PGP key if you like.',
            'contact.send': 'Send an email',
            'contact.pgp': 'PGP key',
            'contact.copy': 'copy',
            'contact.copied': 'copied',
            'contact.built': 'Designed & built by Matteo Scaringella',
            'contact.privacy': 'no cookies · no trackers · strict CSP',
            'detail.back': 'back',
            'detail.context': 'Context',
            'detail.approach': 'Approach',
            'detail.result': 'Result',
            'detail.stack': 'Stack',
            'detail.links': 'Links',
            'detail.todo': 'To be written.',
            'detail.steps': 'Walkthrough',
            'detail.tools': 'Tools',
            'detail.read': 'Read the full writeup',
            'detail.prev': 'Previous',
            'detail.next': 'Next',
            'detail.open': 'Open details',
            'badge.example': 'example',
            'status.obtained': 'obtained',
            'status.in-progress': 'in progress',
            'status.planned': 'planned',
            'cert.verify': 'verify',
            'cert.id': 'ID'
        },
        fr: {
            'meta.description': 'Matteo Scaringella — étudiant en cybersécurité à Ynov. Pentest, hacking éthique, writeups CTF et sécurité des infrastructures.',
            'nav.about': 'À propos',
            'nav.projects': 'Projets',
            'nav.writeups': 'Writeups',
            'nav.certs': 'Certifications',
            'nav.lab': 'Lab',
            'nav.contact': 'Contact',
            'aria.home': 'Accueil',
            'aria.theme': 'Basculer entre thème sombre et clair',
            'aria.lang': 'Switch the site to English',
            'aria.menu': 'Ouvrir le menu',
            'aria.menuClose': 'Fermer le menu',
            'aria.terminal': 'Ouvrir le terminal (T)',
            'aria.sections': 'Sections',
            'hero.eyebrow': 'Étudiant en cybersécurité · Ynov',
            'hero.hello': 'Bonjour, je suis',
            'hero.desc': 'Le pentest avant tout : je cherche les failles des systèmes avant les attaquants — et j’aide à sécuriser les infrastructures qui les portent.',
            'hero.projects': 'Voir les projets',
            'hero.contact': 'Me contacter',
            'about.title': 'À propos',
            'about.p1': 'Étudiant passionné en cybersécurité à Ynov, je suis animé par la curiosité de comprendre comment fonctionnent les systèmes — et comment [[les casser pour les rendre meilleurs]].',
            'about.p2': 'Mon parcours mêle [[hacking éthique]], sécurisation d’[[infrastructures réseau]] et développement d’outils pour [[automatiser les tâches de sécurité]]. J’aime les défis et je me tiens à jour sur les menaces et les mécanismes de défense.',
            'about.focus': 'Domaines',
            'focus.offense': 'Hacking éthique & pentest',
            'focus.network': 'Durcissement d’infrastructure',
            'focus.tooling': 'Automatisation de la sécurité',
            'focus.crypto': 'Chiffrement & messagerie sécurisée',
            'projects.title': 'Projets',
            'writeups.title': 'Writeups',
            'writeups.lead': 'Writeups de CTF et de labs : comment la cible est tombée, et ce qu’un défenseur devrait corriger.',
            'writeups.all': 'tous',
            'writeups.empty': 'Pas encore de writeup dans cette catégorie.',
            'certs.title': 'Certifications',
            'certs.lead': 'Ce qui est obtenu, ce qui est en cours, et la suite.',
            'certs.education': 'Formation',
            'certs.certs': 'Certifications',
            'lab.title': 'HD 110067',
            'lab.eyebrow': 'Lab · projet perso',
            'lab.lead': 'Un moteur de rendu écrit de zéro (sans bibliothèque) qui calcule en direct les éphémérides publiées de six vraies exoplanètes. Cliquez sur un astre, ou faites glisser autour du système pour faire tourner le temps.',
            'contact.title': 'Contact',
            'contact.lead': 'Partant aussi pour rejoindre une équipe CTF ou simplement parler sécurité. Écrivez-moi — chiffré avec ma clé PGP si vous le souhaitez.',
            'contact.send': 'Envoyer un email',
            'contact.pgp': 'Clé PGP',
            'contact.copy': 'copier',
            'contact.copied': 'copié',
            'contact.built': 'Conçu et développé par Matteo Scaringella',
            'contact.privacy': 'aucun cookie · aucun traceur · CSP stricte',
            'detail.back': 'retour',
            'detail.context': 'Contexte',
            'detail.approach': 'Démarche',
            'detail.result': 'Résultat',
            'detail.stack': 'Outils',
            'detail.links': 'Liens',
            'detail.todo': 'À rédiger.',
            'detail.steps': 'Déroulé',
            'detail.tools': 'Outils',
            'detail.read': 'Lire le writeup complet',
            'detail.prev': 'Précédent',
            'detail.next': 'Suivant',
            'detail.open': 'Voir le détail',
            'badge.example': 'exemple',
            'status.obtained': 'obtenue',
            'status.in-progress': 'en cours',
            'status.planned': 'prévue',
            'cert.verify': 'vérifier',
            'cert.id': 'ID'
        }
    };

    let lang = root.lang === 'fr' ? 'fr' : 'en';

    const t = key => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
    // Picks the right language out of a { en, fr } content field (plain strings pass through)
    const pick = value => (value && typeof value === 'object' ? (value[lang] || value.en || '') : (value || ''));

    // "text [[highlight]] text" → text nodes and <mark class="redact"> elements
    function rich(el, str) {
        el.textContent = '';
        str.split(/(\[\[.*?\]\])/).forEach(part => {
            if (!part) return;
            const m = part.match(/^\[\[(.*)\]\]$/);
            if (m) {
                const mark = document.createElement('mark');
                mark.className = 'redact';
                mark.textContent = m[1];
                el.appendChild(mark);
            } else {
                el.appendChild(document.createTextNode(part));
            }
        });
    }

    function apply(scope = document) {
        scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
        scope.querySelectorAll('[data-i18n-rich]').forEach(el => rich(el, t(el.dataset.i18nRich)));
        scope.querySelectorAll('[data-i18n-attr]').forEach(el => {
            el.dataset.i18nAttr.split(';').forEach(pair => {
                const [attr, key] = pair.split(':');
                el.setAttribute(attr.trim(), t(key.trim()));
            });
        });
        document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
    }

    function setLang(next) {
        lang = next === 'fr' ? 'fr' : 'en';
        root.lang = lang;
        try { localStorage.setItem('lang', lang); } catch (e) { }
        apply();
        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    }

    apply();

    window.i18n = { t, pick, apply, setLang, get lang() { return lang; } };
})();
