import { LEGAL, LegalDocSlug } from './config';

export interface LegalBlock {
  type: 'p' | 'ul' | 'note';
  text?: string;
  items?: string[];
}

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: LegalDocSlug;
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT_BLOCK: LegalBlock = {
  type: 'ul',
  items: [
    `Legal entity: ${LEGAL.entityName}`,
    `Registered address: ${LEGAL.registeredAddress}`,
    `Grievance officer: ${LEGAL.grievanceOfficer}`,
    `Grievance email: ${LEGAL.grievanceEmail}`,
    `Support email: ${LEGAL.supportEmail}`,
    `Governing law: ${LEGAL.jurisdiction}`,
  ],
};

const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  description:
    'The rules for using U-R-LIVE, an adults-only live video chat service. Covers eligibility, acceptable use, moderation and liability.',
  intro:
    'These Terms of Service form a binding agreement between you and the operator of U-R-LIVE. By creating a session, browsing the site or starting a video chat, you accept these terms.',
  sections: [
    {
      id: 'agreement',
      heading: '1. The agreement',
      blocks: [
        {
          type: 'p',
          text: 'U-R-LIVE is an adults-only (18+) live video chat service that connects two independent users for a real-time, peer-to-peer conversation. U-R-LIVE does not select, script or record conversations, and it does not guarantee that a match will be available at any given moment.',
        },
        {
          type: 'p',
          text: 'If you do not accept these terms, do not use the service. If you use U-R-LIVE on behalf of an organisation, you confirm that you have authority to bind that organisation.',
        },
      ],
    },
    {
      id: 'eligibility',
      heading: '2. Eligibility and age assurance',
      blocks: [
        {
          type: 'p',
          text: `You must be at least ${LEGAL.minimumAge} years old, or the age of majority in your jurisdiction if that is higher. You must confirm your age before entering a live session. Providing false age information is a material breach of these terms.`,
        },
        {
          type: 'p',
          text: 'We may use age gates, session checks, user reports and moderator review to enforce this requirement. Accounts that we reasonably believe belong to a minor are terminated immediately and may be reported to the relevant authorities.',
        },
      ],
    },
    {
      id: 'accounts',
      heading: '3. Guest sessions, accounts and security',
      blocks: [
        {
          type: 'p',
          text: 'You can use U-R-LIVE as an anonymous guest. Guest sessions are stored in your browser and are not portable across devices. Optional sign-in providers (for example Google) let you keep preferences and your profile across devices.',
        },
        {
          type: 'ul',
          items: [
            'Keep your session token private. Anyone with access to your browser session can act as you.',
            'You are responsible for activity that occurs under your session.',
            'Do not create sessions through automated means, proxies or rotators to evade rate limits or moderation.',
            'Do not impersonate another person, moderator or staff member.',
          ],
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '4. Acceptable use',
      blocks: [
        {
          type: 'p',
          text: 'The Community Rules are part of these terms. In summary, you must not:',
        },
        {
          type: 'ul',
          items: [
            'Broadcast nudity, sexual content, sexual exploitation or non-consensual intimate imagery.',
            'Harass, threaten, stalk, bully or incite hatred against any person or group.',
            'Display weapons, violence, self-harm or illegal activity.',
            'Record, screenshot or rebroadcast another user without their explicit consent.',
            'Advertise, solicit, run scams, distribute malware or operate bots.',
            'Share another person’s private information without permission.',
            'Attempt to bypass age checks, rate limits, bans or other safety controls.',
          ],
        },
        {
          type: 'note',
          text: 'Consent must be explicit and can be withdrawn at any time. If someone asks you to stop, stop and end the call.',
        },
      ],
    },
    {
      id: 'recording',
      heading: '5. Zero recording and media handling',
      blocks: [
        {
          type: 'p',
          text: 'Video and audio are transmitted directly between the two browsers using WebRTC with DTLS/SRTP encryption. U-R-LIVE does not record, store or monitor the content of calls. TURN relay servers, where used, forward encrypted media packets and do not inspect or retain them.',
        },
        {
          type: 'p',
          text: 'Other participants may still capture their screen with third-party tools. Do not share anything you would not want recorded, and report suspected recording immediately.',
        },
      ],
    },
    {
      id: 'moderation',
      heading: '6. Moderation and enforcement',
      blocks: [
        {
          type: 'p',
          text: 'We use a combination of automated rate limits, user reports and human review. Enforcement may include warnings, feature restrictions, temporary suspension, permanent bans, and reporting to law enforcement where required.',
        },
        {
          type: 'p',
          text: 'Reports are reviewed by the safety team. You can appeal an enforcement decision by contacting the grievance officer. Appeals are reviewed by a person who was not involved in the original decision.',
        },
      ],
    },
    {
      id: 'privacy',
      heading: '7. Privacy',
      blocks: [
        {
          type: 'p',
          text: 'Our Privacy Policy and Cookie Policy explain what we collect and why. In short: we collect the minimum needed to run matchmaking and safety, we do not sell personal data, and we do not use advertising cookies.',
        },
      ],
    },
    {
      id: 'availability',
      heading: '8. Availability and changes',
      blocks: [
        {
          type: 'p',
          text: 'The service is provided on an “as available” basis. We may change, suspend or discontinue features, including during maintenance. We aim to give reasonable notice of material changes.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '9. Disclaimers and limitation of liability',
      blocks: [
        {
          type: 'p',
          text: 'To the maximum extent permitted by law, U-R-LIVE is not liable for the conduct of users, for content exchanged between users, or for indirect, incidental, special or consequential damages. Nothing in these terms limits liability that cannot be limited by law.',
        },
        {
          type: 'p',
          text: 'You are solely responsible for your interactions with other users and for complying with the laws that apply to you. Use caution when sharing personal information.',
        },
      ],
    },
    {
      id: 'indemnity',
      heading: '10. Indemnity',
      blocks: [
        {
          type: 'p',
          text: 'You agree to indemnify and hold harmless U-R-LIVE, its operator and its staff from claims, damages and costs arising from your breach of these terms, your content, or your unlawful use of the service.',
        },
      ],
    },
    {
      id: 'law',
      heading: '11. Governing law, disputes and contact',
      blocks: [
        {
          type: 'p',
          text: `These terms are governed by the laws of ${LEGAL.jurisdiction}. Disputes are subject to the exclusive jurisdiction of the courts there, unless mandatory consumer law in your country gives you additional rights.`,
        },
        {
          type: 'p',
          text: 'If you have a concern, contact the grievance officer first. We aim to acknowledge complaints within 24 hours and resolve them within 15 days.',
        },
        CONTACT_BLOCK,
      ],
    },
    {
      id: 'changes',
      heading: '12. Changes to these terms',
      blocks: [
        {
          type: 'p',
          text: `We may update these terms when the service or the law changes. The current version is dated ${LEGAL.effectiveDate}. Material changes are announced in the product and require you to accept the new version before continuing to use live features.`,
        },
      ],
    },
  ],
};

const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  description:
    'What U-R-LIVE collects, why, how long it is kept, who processes it, and the rights you have over your personal data.',
  intro:
    'U-R-LIVE is designed to collect as little as possible. This policy explains the data we process to run matchmaking and safety, and the choices you have.',
  sections: [
    {
      id: 'controller',
      heading: '1. Who is responsible for your data',
      blocks: [
        {
          type: 'p',
          text: `${LEGAL.entityName} is the data controller for U-R-LIVE. Contact details, including our grievance officer, are listed at the end of this policy.`,
        },
      ],
    },
    {
      id: 'collect',
      heading: '2. What we collect',
      blocks: [
        {
          type: 'ul',
          items: [
            'Session data: a randomly generated user ID, session token (stored in your browser), role and expiry.',
            'Profile data you choose to provide: display name, gender, country, language and matching preferences.',
            'Consent records: the version of the terms you accepted, the time of acceptance, and a hashed record of the request context.',
            'Safety data: reports, blocks, moderation notes and audit logs.',
            'Technical data: IP address and coarse device information used for rate limiting, abuse prevention and aggregate traffic metrics.',
          ],
        },
        {
          type: 'note',
          text: 'We do not collect your video or audio. Calls are peer-to-peer and are not recorded or stored by U-R-LIVE.',
        },
      ],
    },
    {
      id: 'guest',
      heading: '3. Guest sessions',
      blocks: [
        {
          type: 'p',
          text: 'You can use live chat without creating an account. A guest session is created on our server and identified by a signed token in your browser. Guest sessions carry no email address and expire automatically.',
        },
      ],
    },
    {
      id: 'why',
      heading: '4. Why we process data (legal bases)',
      blocks: [
        {
          type: 'ul',
          items: [
            'To provide the service: matchmaking, preferences and sessions (performance of a contract).',
            'To keep the platform safe: age assurance, reports, blocks and rate limiting (legitimate interests and legal obligations).',
            'To improve reliability: aggregate, cookie-less usage metrics (legitimate interests).',
            'To comply with lawful requests from authorities (legal obligation).',
          ],
        },
        {
          type: 'p',
          text: 'Where Indian law applies, we process personal data in line with the Digital Personal Data Protection Act, 2023. Where the GDPR applies, the legal bases above correspond to Article 6.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '5. Cookies and local storage',
      blocks: [
        {
          type: 'p',
          text: 'We do not use advertising cookies. We use strictly necessary browser storage for your session token and UI preferences, and optional cookie-less analytics that do not identify you. See the Cookie Policy for details.',
        },
      ],
    },
    {
      id: 'processors',
      heading: '6. Processors and third parties',
      blocks: [
        {
          type: 'ul',
          items: [
            'Cloud infrastructure (Google Cloud) — hosting, database, queueing and content delivery.',
            'Cloudflare Turnstile — bot protection on report submissions when enabled.',
            'Google Sign-In — optional authentication; governed by Google’s privacy policy.',
            'Privacy-first analytics — aggregate page and funnel metrics without cookies or cross-site tracking.',
          ],
        },
        {
          type: 'p',
          text: 'We do not sell personal data. We share data with authorities only where legally required and after reviewing the request.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '7. How long we keep data',
      blocks: [
        {
          type: 'ul',
          items: [
            'Guest sessions and queue entries: until expiry or shortly after disconnect.',
            'Account and preference data: while your account is active, then deleted or anonymised on request unless retention is legally required.',
            'Consent records: for as long as you use the service, to demonstrate compliance.',
            'Safety reports and audit logs: up to 24 months, or longer if needed for an investigation or legal claim.',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '8. Your rights',
      blocks: [
        {
          type: 'p',
          text: 'Subject to applicable law, you may request access to your data, correction, deletion, a portable copy, restriction of processing, or object to processing based on legitimate interests. You may also withdraw consent where processing is based on consent.',
        },
        {
          type: 'p',
          text: `To exercise a right, email ${LEGAL.grievanceEmail} from a contact address associated with your account, or include your session details if you use a guest session. We respond within the time required by law.`,
        },
      ],
    },
    {
      id: 'security',
      heading: '9. Security',
      blocks: [
        {
          type: 'p',
          text: 'We use signed, expiring session tokens, hashed token storage, TLS in transit, least-privilege access and rate limiting. Media is encrypted end-to-end between browsers with DTLS/SRTP. No system is perfectly secure; report suspected vulnerabilities to the support address.',
        },
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      blocks: [
        {
          type: 'p',
          text: 'U-R-LIVE is strictly for adults. We do not knowingly collect data from anyone under 18. If we learn that a minor has used the service, we delete the associated data and block access.',
        },
      ],
    },
    {
      id: 'transfers',
      heading: '11. International transfers',
      blocks: [
        {
          type: 'p',
          text: 'Our infrastructure may process data in regions outside your own. Where required, we use appropriate safeguards for cross-border transfers.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '12. Grievance officer and contact',
      blocks: [
        {
          type: 'p',
          text: 'Complaints about privacy or data handling can be sent to our grievance officer. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.',
        },
        CONTACT_BLOCK,
      ],
    },
    {
      id: 'changes',
      heading: '13. Changes to this policy',
      blocks: [
        {
          type: 'p',
          text: `This policy is effective from ${LEGAL.effectiveDate}. We will announce material changes in the product before they take effect.`,
        },
      ],
    },
  ],
};

const COOKIES: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie Policy',
  description:
    'The strictly necessary browser storage U-R-LIVE uses, why there is no advertising cookie banner, and how to clear your data.',
  intro:
    'U-R-LIVE does not use advertising or cross-site tracking cookies. This page lists the browser storage we do use and how to control it.',
  sections: [
    {
      id: 'stance',
      heading: '1. Our approach',
      blocks: [
        {
          type: 'p',
          text: 'We only store what a live video service needs to work: your session and a few interface preferences. Because we do not use advertising or analytics cookies, you will not see a consent banner asking you to accept tracking.',
        },
      ],
    },
    {
      id: 'necessary',
      heading: '2. Strictly necessary storage',
      blocks: [
        {
          type: 'ul',
          items: [
            'omelive_session_token — signed session token used to authenticate API and signaling requests. Stored in sessionStorage and, for signed-in accounts, localStorage. Expires with the session.',
            'omelive_session_user_id — your pseudonymous user identifier, used to restore your session in the same browser.',
            'omelive_offline_state_v1 — locally cached profile and preferences for faster startup. Cleared when you clear site data.',
          ],
        },
        {
          type: 'note',
          text: 'These entries are required for the service to function. Blocking them will prevent live chat from connecting.',
        },
      ],
    },
    {
      id: 'analytics',
      heading: '3. Cookie-less analytics',
      blocks: [
        {
          type: 'p',
          text: 'We use aggregate, privacy-first measurement to understand which pages load and where the funnel breaks. It does not set cookies, does not fingerprint devices, and does not track you across other websites. IP addresses are truncated before storage.',
        },
      ],
    },
    {
      id: 'third-party',
      heading: '4. Third-party services',
      blocks: [
        {
          type: 'ul',
          items: [
            'Cloudflare Turnstile — may set a challenge token when you submit a report, to stop spam.',
            'Google Sign-In — loaded only if you choose to sign in with Google.',
          ],
        },
      ],
    },
    {
      id: 'control',
      heading: '5. How to clear your data',
      blocks: [
        {
          type: 'ul',
          items: [
            'Use your browser’s “Clear site data” option to remove local and session storage.',
            'Use private/incognito windows to avoid leaving persistent storage behind.',
            'Sign out or clear your session if you use a shared device.',
            `Contact ${LEGAL.grievanceEmail} if you need help deleting account data held on our servers.`,
          ],
        },
      ],
    },
    {
      id: 'changes',
      heading: '6. Changes',
      blocks: [
        {
          type: 'p',
          text: `If we ever introduce non-essential storage, we will update this page and ask for consent where required. This version is effective from ${LEGAL.effectiveDate}.`,
        },
      ],
    },
  ],
};

const COMMUNITY_RULES: LegalDoc = {
  slug: 'community-rules',
  title: 'Community Rules',
  description:
    'The conduct standards for U-R-LIVE: consent, prohibited behaviour, enforcement and how to report a problem.',
  intro:
    'U-R-LIVE connects strangers for live conversation. These rules keep it safe for adults who expect respect. They apply to video, audio, chat and any linked content.',
  sections: [
    {
      id: 'consent',
      heading: '1. Consent is the baseline',
      blocks: [
        {
          type: 'ul',
          items: [
            'Ask before changing the tone of a conversation, and stop immediately when asked.',
            'Never record, photograph or stream another person without their explicit consent.',
            'Do not pressure anyone to reveal personal information, remove clothing or continue a call.',
            'You can end any conversation at any time without explanation.',
          ],
        },
      ],
    },
    {
      id: 'prohibited',
      heading: '2. Prohibited conduct',
      blocks: [
        {
          type: 'ul',
          items: [
            'Nudity, sexual acts, sexual exploitation or content involving minors in any form.',
            'Non-consensual intimate imagery or sharing someone’s private information.',
            'Harassment, threats, stalking, hate speech or discrimination.',
            'Violence, weapons, self-harm, or instructions for illegal activity.',
            'Spam, scams, phishing, malware, unsolicited advertising or affiliate links.',
            'Bots, scripts, pre-recorded loops or automated matchmaking.',
            'Impersonating staff, moderators or other users.',
            'Evading bans, rate limits or age checks.',
          ],
        },
      ],
    },
    {
      id: 'age',
      heading: '3. Adults only',
      blocks: [
        {
          type: 'p',
          text: 'You must be at least 18. If you suspect that someone is underage, end the call and report it immediately using the report button. Do not share the encounter elsewhere.',
        },
      ],
    },
    {
      id: 'reporting',
      heading: '4. Reporting and blocking',
      blocks: [
        {
          type: 'p',
          text: 'Use the in-call report button to flag a conversation. Reporting also blocks the other person from future matches with you. Reports are rate limited to prevent abuse of the system.',
        },
        {
          type: 'ul',
          items: [
            'Choose the category that best matches the behaviour.',
            'Include what happened and, if relevant, the approximate time.',
            'Urgent safety issues involving a minor or immediate danger should also be reported to local authorities.',
          ],
        },
      ],
    },
    {
      id: 'enforcement',
      heading: '5. Enforcement',
      blocks: [
        {
          type: 'ul',
          items: [
            'First serious violation: immediate removal from the call and a warning or suspension.',
            'Repeat or severe violations: temporary or permanent ban.',
            'Illegal content: preservation of relevant records and referral to law enforcement where required.',
            'Evasion of an enforcement action: permanent ban.',
          ],
        },
        {
          type: 'p',
          text: 'Enforcement decisions are reviewed by the safety team. You can appeal by contacting the grievance officer; appeals are handled by someone not involved in the original decision.',
        },
      ],
    },
    {
      id: 'privacy',
      heading: '6. Respect privacy',
      blocks: [
        {
          type: 'p',
          text: 'Do not ask for or share addresses, financial details, identity documents or other sensitive information. Do not attempt to identify or contact someone outside the platform without their consent.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '7. Contact',
      blocks: [CONTACT_BLOCK],
    },
  ],
};

export const LEGAL_CONTENT: Record<LegalDocSlug, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  cookies: COOKIES,
  'community-rules': COMMUNITY_RULES,
};
