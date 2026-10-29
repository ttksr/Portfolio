// ─────────────────────────────────────────────────────────────────────────────
//  Site content — the only file to edit to update the portfolio.
//  The page and the terminal both read from here.
//
//  • Texts that change with the language are { en: '…', fr: '…' }.
//  • Leave a field empty ('' or []) to hide it.
//  • Entries with `example: true` are templates: they show an "example" badge.
//    Replace them with your own (and remove the flag), or delete them.
// ─────────────────────────────────────────────────────────────────────────────

window.CONTENT = {
    profile: {
        email: 'mat.scaringella@gmail.com',
        github: 'https://github.com/ttksr',
        pgp: 'assets/pgp/pubkey.asc',
        // Shown next to the key so people can check they got the right one (gpg --fingerprint)
        pgpFingerprint: '61BF A2DD D908 3789 7E6B  8B1A FD46 6D32 77FE 602F',
        // What you're looking for, shown on the contact panel
        seeking: {
            en: 'Looking for a 1–2 month internship from May 2027 in cybersecurity, networking, system administration, SOC or IT support.',
            fr: 'Recherche un stage de 1 à 2 mois à partir de mai 2027 en cybersécurité, réseaux, administration système, SOC ou support.'
        }
    },

    projects: [
        {
            id: 'network-scanner',
            title: 'Network Scanner',
            tags: ['python', 'recon'],
            summary: { en: 'Python script for vulnerability scanning.', fr: 'Script Python de scan de vulnérabilités.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: [] // [{ label: 'GitHub', url: 'https://…' }]
        },
        {
            id: 'secure-chat',
            title: 'Secure Chat',
            tags: ['e2ee', 'crypto'],
            summary: { en: 'End-to-end encrypted messaging app.', fr: 'Messagerie chiffrée de bout en bout.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: []
        },
        {
            id: 'firewall-rules',
            title: 'Firewall Rules',
            tags: ['iptables', 'automation'],
            summary: { en: 'Automated iptables configuration tool.', fr: 'Outil de configuration iptables automatisée.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: []
        },
        {
            id: 'packet-analyzer',
            title: 'Packet Analyzer',
            tags: ['pcap', 'network'],
            summary: { en: 'Traffic analysis using Wireshark libraries.', fr: 'Analyse de trafic avec les bibliothèques de Wireshark.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: []
        },
        {
            id: 'pentest-report',
            title: 'PenTest Report',
            tags: ['pentest', 'reporting'],
            summary: { en: 'Automated reporting for penetration tests.', fr: 'Génération automatisée de rapports de test d’intrusion.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: []
        },
        {
            id: 'crypto-tool',
            title: 'Crypto Tool',
            tags: ['crypto', 'cli'],
            summary: { en: 'Encryption / decryption utility suite.', fr: 'Suite d’outils de chiffrement / déchiffrement.' },
            context: { en: '', fr: '' },
            approach: { en: '', fr: '' },
            result: { en: '', fr: '' },
            stack: [],
            links: []
        }
    ],

    writeups: [
        {
            example: true,
            id: 'example-web',
            title: '[Machine or challenge name]',
            platform: 'HackTheBox',          // HackTheBox, Root-Me, TryHackMe, CTF name…
            category: 'web',                 // web, pwn, crypto, forensics, reverse, network, osint…
            difficulty: 'medium',            // easy, medium, hard, insane
            date: '2026-10',
            summary: {
                en: 'One or two sentences on the vulnerability chain, from foothold to root.',
                fr: 'Une ou deux phrases sur la chaîne de vulnérabilités, de l’accès initial au root.'
            },
            steps: [
                { en: 'Recon: what you enumerated and what stood out.', fr: 'Reconnaissance : ce que tu as énuméré et ce qui ressortait.' },
                { en: 'Foothold: the vulnerability and how you exploited it.', fr: 'Accès initial : la vulnérabilité et comment tu l’as exploitée.' },
                { en: 'Privilege escalation: the misconfiguration that led to root.', fr: 'Élévation de privilèges : la mauvaise configuration qui a mené au root.' },
                { en: 'Lesson: what a defender should fix.', fr: 'Leçon : ce qu’un défenseur devrait corriger.' }
            ],
            tools: ['nmap', 'burp suite', 'linpeas'],
            url: ''                          // link to the full writeup (blog, GitHub, PDF…)
        },
        {
            example: true,
            id: 'example-crypto',
            title: '[Challenge name]',
            platform: 'Root-Me',
            category: 'crypto',
            difficulty: 'easy',
            date: '2026-09',
            summary: {
                en: 'What the challenge was about and the key insight that broke it.',
                fr: 'Le principe du challenge et l’idée clé qui a permis de le casser.'
            },
            steps: [
                { en: 'Analysis of the given material.', fr: 'Analyse des éléments fournis.' },
                { en: 'The weakness and the attack.', fr: 'La faiblesse et l’attaque.' }
            ],
            tools: ['python', 'sage'],
            url: ''
        }
    ],

    certifications: [
        {
            // Learning-path completion certificate (not the paid SEC0 exam): labelled as such
            name: { en: 'Pre Security — learning path', fr: 'Pre Security — parcours' },
            issuer: 'TryHackMe',
            status: 'obtained',
            date: '2026',
            credential: '',
            url: ''                          // public link to the certificate, if you want to add it
        },
        {
            name: 'HTB CJCA — Certified Junior Cybersecurity Associate',
            issuer: 'Hack The Box',
            status: 'in-progress',           // obtained, in-progress, planned
            date: '',                        // once obtained, e.g. '2027-01'
            credential: '',                  // credential ID, once obtained
            url: ''                          // verification link, once obtained
        }
    ],

    education: [
        {
            // Title of the final degree, obtained at the end of the program
            name: { en: 'Cybersecurity Expert', fr: 'Expert en Cybersécurité' },
            school: 'Ynov Campus',
            status: 'in-progress'
        }
    ]
};
