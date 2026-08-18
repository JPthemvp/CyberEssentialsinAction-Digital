// Cyber Essentials in Action (Digital) — Game Data
// All content sourced from CSA Cyber Essentials in Action Facilitator Guide

export const SECTORS = [
  { id: 'minlaw', label: 'MinLaw Clinic', icon: '⚖️', desc: 'Legal & Law Firms' },
  { id: 'hia', label: 'HIA Clinic', icon: '🏥', desc: 'Healthcare & Healthtech' },
  { id: 'finance', label: 'Finance Clinic', icon: '🏦', desc: 'Finance & Banking' },
  { id: 'retail', label: 'Retail & F&B', icon: '🛍️', desc: 'Retail, Food & Beverage' },
  { id: 'tech', label: 'Tech Sector', icon: '💻', desc: 'Technology & ICT' },
  { id: 'education', label: 'Education', icon: '🎓', desc: 'Schools & Higher Education' },
  { id: 'general', label: 'General Business', icon: '🏢', desc: 'All other sectors' },
];

export interface AttackQuestion {
  id: string;
  category: string;
  categoryIcon: string;
  pillar: string; // ASSETS / SECURE / UPDATE / BACKUP / RESPOND
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  funFact?: string;
}

export const CYBER_ATTACK_QUESTIONS: AttackQuestion[] = [
  // --- ASSETS: PEOPLE ---
  {
    id: 'a01',
    category: 'Social Engineering',
    categoryIcon: '🎭',
    pillar: 'ASSETS – PEOPLE',
    question: 'What do threat actors do to trick employees into taking action through social engineering?',
    options: [
      'Create urgent scenarios and impersonate trusted parties',
      'Send letters through physical mail only',
      'Hack your device silently without any interaction',
      'Only target company executives, not regular staff',
    ],
    correctIndex: 0,
    explanation: 'Threat actors create urgency (e.g. time-limited offers) and pretend to be trusted parties like your payment service or management.',
    funFact: 'Social engineering is the #2 top cybersecurity incident in Singapore organisations.',
  },
  {
    id: 'a02',
    category: 'Deepfake',
    categoryIcon: '🤖',
    pillar: 'ASSETS – PEOPLE',
    question: 'In 2024, a Hong Kong finance worker was tricked into transferring HK$200M. What type of attack was used?',
    options: [
      'Ransomware encryption',
      'Deepfake video conference impersonating the CFO',
      'Phishing email with malicious attachment',
      'SIM card swapping',
    ],
    correctIndex: 1,
    explanation: 'The employee was on a video conference call with deepfake versions of his UK CFO and colleagues — all AI-generated fakes — and transferred the funds believing they were real.',
    funFact: '3 out of 4 people in Singapore cannot identify deepfake content (CSA survey 2025).',
  },
  {
    id: 'a03',
    category: 'Deepfake Defense',
    categoryIcon: '🛡️',
    pillar: 'ASSETS – PEOPLE',
    question: 'Your CFO (overseas) calls you via video to urgently transfer funds to a new supplier. What should you do FIRST?',
    options: [
      'Transfer the funds immediately — the deadline is urgent',
      'Ignore the call and email HR about it',
      'Contact your CFO separately via another channel to confirm the instruction',
      'Ask the accounting department to approve it instead',
    ],
    correctIndex: 2,
    explanation: 'Always verify high-value instructions out-of-band — call your CFO on a known number, or ask a question only they would know the answer to.',
  },
  {
    id: 'a04',
    category: 'Third-Party Assets',
    categoryIcon: '🔌',
    pillar: 'ASSETS – HARDWARE & SOFTWARE',
    question: 'A vendor wants to connect their laptop to your corporate network for a demo. Why is this risky?',
    options: [
      'It slows down your internet connection',
      'Their device may contain malware that could spread to your network',
      'It uses up all available IP addresses',
      'It is against office etiquette rules only',
    ],
    correctIndex: 1,
    explanation: 'External devices may carry viruses, trojans, ransomware, or spyware that can infect all devices on the network once connected.',
  },
  {
    id: 'a05',
    category: 'Unauthorised Software',
    categoryIcon: '📦',
    pillar: 'ASSETS – HARDWARE & SOFTWARE',
    question: 'Why should you only install software from trusted/authorised sources on your work device?',
    options: [
      'Unauthorised apps use more battery',
      'Software from untrusted sources may contain malicious code to launch attacks',
      'It slows down software updates',
      'Only for performance reasons — security is managed by IT',
    ],
    correctIndex: 1,
    explanation: 'Google reports that apps from outside the Play Store are 50× more likely to contain malware. Unauthorised software can be a trojan horse for attackers.',
  },
  {
    id: 'a06',
    category: 'Shadow IT / Shadow AI',
    categoryIcon: '👻',
    pillar: 'ASSETS – HARDWARE & SOFTWARE',
    question: 'Why must employees inform IT when signing up for SaaS software or using third-party AI services?',
    options: [
      'So IT can invoice the cost to the correct department',
      'IT can only protect assets they know about — hidden tools create "Shadow IT/AI"',
      'It is only required for AI tools, not regular SaaS',
      'So they can block access to prevent distraction',
    ],
    correctIndex: 1,
    explanation: 'IBM 2025 found 20% of organisations suffered a breach due to Shadow AI incidents, exposing 65% more personal data and 40% more intellectual property.',
    funFact: 'Shadow AI = using AI tools that are not approved by your organisation\'s IT team.',
  },
  // --- ASSETS: DATA ---
  {
    id: 'a07',
    category: 'Data Leakage',
    categoryIcon: '💧',
    pillar: 'ASSETS – DATA',
    question: 'Which of these is a method to protect sensitive data at rest and in transit?',
    options: [
      'Store it in a shared folder for easy access',
      'Password-protect or encrypt files and disable USB ports',
      'Only share data via email, never cloud',
      'Keep data on paper printouts instead of digital',
    ],
    correctIndex: 1,
    explanation: 'Encrypting files and disabling USB ports prevents unauthorised access and data leakage through physical media.',
  },
  {
    id: 'a08',
    category: 'Cloud Data Breach',
    categoryIcon: '☁️',
    pillar: 'ASSETS – DATA',
    question: 'What should you consider when storing corporate data in the cloud?',
    options: [
      'Only the cost of storage and speed of access',
      'Security of data transfer AND data sovereignty/geolocation requirements',
      'Whether the cloud provider has a nice mobile app',
      'Nothing — cloud providers handle all security automatically',
    ],
    correctIndex: 1,
    explanation: 'You must consider how securely data moves to/from the cloud, AND whether regulations require data to remain in specific jurisdictions.',
  },
  {
    id: 'a09',
    category: 'Third-Party AI Tools',
    categoryIcon: '🤖',
    pillar: 'ASSETS – DATA',
    question: 'Before using a third-party AI transcription tool for a meeting summary, what should you check?',
    options: [
      'Whether the AI gives answers faster than doing it manually',
      'Your organisation\'s data use policies and whether the tool is whitelisted',
      'If the AI has been reviewed on tech blogs',
      'Whether the tool is free or paid',
    ],
    correctIndex: 1,
    explanation: 'Samsung employees leaked trade secrets to ChatGPT in 3 separate incidents — source code, program code, and meeting recordings were all submitted.',
  },
  {
    id: 'a10',
    category: 'Unexpected AI Output',
    categoryIcon: '⚠️',
    pillar: 'ASSETS – DATA',
    question: 'Why should employees monitor and report unusual output from generative AI tools?',
    options: [
      'To collect data for company performance reports',
      'AI tools may hallucinate or produce manipulated output due to cyberattacks',
      'To report it to the AI vendor for product improvement only',
      'Only managers need to monitor AI outputs',
    ],
    correctIndex: 1,
    explanation: 'Microsoft\'s AI tool once recommended Ottawa Food Bank as a tourist "attraction" and advised tourists to visit on an empty stomach — a classic AI hallucination.',
  },
  {
    id: 'a11',
    category: 'AI Manipulation',
    categoryIcon: '💉',
    pillar: 'ASSETS – DATA',
    question: 'Your company launches a customer service AI chatbot. What can protect it against prompt injection attacks?',
    options: [
      'Only allow customers to use the chatbot during business hours',
      'Review the provider\'s security posture and implement LLM firewalls',
      'Make the chatbot respond only in English',
      'Prompt injection only affects open-source AI tools',
    ],
    correctIndex: 1,
    explanation: 'Researchers demonstrated a prompt injection attack via a poisoned Google Calendar invite that took control of a smart home — real AI manipulation is already happening.',
  },
  {
    id: 'a12',
    category: 'AI Hallucination',
    categoryIcon: '🌀',
    pillar: 'ASSETS – DATA',
    question: 'Your company uses generative AI to write articles. An AI hallucination results in published false information. How could this have been prevented?',
    options: [
      'Use AI only for internal documents, never public content',
      'Implement human review of AI-generated content before publication',
      'Switch to a different AI provider immediately',
      'Add a disclaimer after the fact — no other action needed',
    ],
    correctIndex: 1,
    explanation: 'Air Canada was ordered to pay compensation after its chatbot gave wrong bereavement fare information — the court found the airline responsible for its chatbot\'s errors.',
  },
  // --- SECURE/PROTECT ---
  {
    id: 'a13',
    category: 'Malicious Internet Traffic',
    categoryIcon: '🦠',
    pillar: 'SECURE/PROTECT – VIRUS & MALWARE',
    question: 'You work in a small startup with no corporate network — employees use personal laptops on cloud services. How should laptops be protected from malicious traffic?',
    options: [
      'Use a VPN only — that is sufficient protection',
      'Install virus/malware protection software AND a host-based firewall',
      'Rely on the cloud providers\' built-in security',
      'Avoid visiting non-work websites',
    ],
    correctIndex: 1,
    explanation: 'Malicious bots were behind nearly half of web traffic in Singapore (Straits Times, May 2025). Every device needs its own malware protection and firewall.',
  },
  {
    id: 'a14',
    category: 'Insecure Network',
    categoryIcon: '📶',
    pillar: 'SECURE/PROTECT – VIRUS & MALWARE',
    question: 'You are working from a café and need to access the corporate network. What is the BEST approach?',
    options: [
      'Use the café\'s free WiFi — it\'s convenient and fast',
      'Use mobile hotspot or personal WiFi, and connect via VPN',
      'Only access non-sensitive files on public WiFi',
      'Ask the café for the WiFi password that staff use',
    ],
    correctIndex: 1,
    explanation: '"Evil twin" attacks set up fake WiFi networks in airports and cafés. An Australian man was charged for doing exactly this to steal credentials on domestic flights.',
  },
  {
    id: 'a15',
    category: 'Compromised Credentials',
    categoryIcon: '🔑',
    pillar: 'SECURE/PROTECT – ACCESS CONTROL',
    question: 'Which of these is an example of a STRONG passphrase?',
    options: [
      'Password123!',
      'IhadKAYAtoast@8am',
      'john1990singapore',
      'Abcd1234',
    ],
    correctIndex: 1,
    explanation: 'A strong passphrase uses random words, is at least 12 characters, includes upper/lower case + numbers/symbols, and is unique per account.',
    funFact: 'IhadKAYAtoast@8am — memorable, long, mixed characters. Never reuse passphrases!',
  },
  {
    id: 'a16',
    category: 'Multi-Factor Authentication',
    categoryIcon: '📱',
    pillar: 'SECURE/PROTECT – ACCESS CONTROL',
    question: 'What does "something you ARE" mean in Multi-Factor Authentication (MFA)?',
    options: [
      'Your username or employee ID',
      'Your fingerprint or facial recognition (biometrics)',
      'An authenticator app on your phone',
      'A one-time PIN sent via email',
    ],
    correctIndex: 1,
    explanation: 'MFA uses: Something you KNOW (password), Something you HAVE (authenticator app/token), Something you ARE (biometrics). MFA makes you 99% less likely to be hacked.',
  },
  {
    id: 'a17',
    category: 'Managing Passphrases',
    categoryIcon: '🗝️',
    pillar: 'SECURE/PROTECT – ACCESS CONTROL',
    question: 'You have accounts with many cloud services and can\'t remember all passwords. What should you do?',
    options: [
      'Use the same strong password for all accounts — memorise one',
      'Write passwords in a notebook kept at your desk',
      'Use unique strong passphrases + a trusted password manager, and explore SSO',
      'Use simple passwords so they are easier to remember',
    ],
    correctIndex: 2,
    explanation: 'Weak/reused credentials were the top attack vector in 47% of cloud environment attacks in H1 2024. A password manager + SSO dramatically reduces risk.',
  },
  {
    id: 'a18',
    category: 'Third-Party Access',
    categoryIcon: '🤝',
    pillar: 'SECURE/PROTECT – ACCESS CONTROL',
    question: 'How should your organisation manage third-party vendor access to your data and systems?',
    options: [
      'Give vendors full admin access so they can work efficiently',
      'Have them sign an NDA and limit access to only what is needed, then remove it when done',
      'Allow access from 9am–5pm only',
      'Share credentials via a secure email',
    ],
    correctIndex: 1,
    explanation: '12 moneylenders\' personal data of 128,000 customers was stolen after their shared IT vendor was hacked — limiting access scope limits blast radius.',
  },
  {
    id: 'a19',
    category: 'Unused Services',
    categoryIcon: '🚫',
    pillar: 'SECURE/PROTECT – SECURE CONFIGURATION',
    question: 'Why should you disable or remove features, services, and applications not in use on your device?',
    options: [
      'To free up storage space on your device',
      'Unused services reduce attack surface — attackers exploit known vulnerabilities in them',
      'Company policy requires it for auditing only',
      'Active services use more electricity',
    ],
    correctIndex: 1,
    explanation: 'Remote Desktop Protocol (RDP) — even when "not used" — is commonly exploited by ransomware attackers to enter systems and deploy ransomware.',
  },
  {
    id: 'a20',
    category: 'Cloud Misconfiguration',
    categoryIcon: '⚙️',
    pillar: 'SECURE/PROTECT – SECURE CONFIGURATION',
    question: 'Why should cloud users review default configuration settings for their cloud services?',
    options: [
      'Default settings are always the most secure option',
      'Cloud misconfigs are a top threat — default settings are tuned for usability, not security',
      'To unlock premium features of the cloud service',
      'Only required for regulated industries like banking',
    ],
    correctIndex: 1,
    explanation: 'Cloud Security Alliance ranks misconfiguration as a top cloud threat — often caused by human error, lack of knowledge, or not following security best practices.',
  },
  // --- UPDATE ---
  {
    id: 'a21',
    category: 'Software Updates',
    categoryIcon: '🔄',
    pillar: 'UPDATE',
    question: 'Your computer shows a software update reminder while you\'re rushing a deadline. Why is it important NOT to delay?',
    options: [
      'Updates only improve performance, not security',
      'New vulnerabilities can be discovered and exploited — patches close those gaps',
      'IT will force the update anyway after office hours',
      'Skipping one update is fine if you install the next one',
    ],
    correctIndex: 1,
    explanation: 'Attackers now use AI automation to scan, confirm, and exploit vulnerabilities faster than ever. Delayed patches = open doors for attackers.',
  },
  // --- BACKUP ---
  {
    id: 'a22',
    category: 'Backup Location',
    categoryIcon: '💾',
    pillar: 'BACKUP',
    question: 'Why should backups be stored SEPARATELY from your operating environment?',
    options: [
      'It is cheaper to store backups on a different server',
      'If the operating environment is compromised, separately stored backups remain safe',
      'Regulations require it for financial reporting purposes',
      'Cloud backups don\'t need to be stored separately',
    ],
    correctIndex: 1,
    explanation: 'A Canadian medical clinic hit by ransomware had its backups deleted by the threat actor. The clinic closed temporarily because it couldn\'t restore from backup.',
  },
  {
    id: 'a23',
    category: 'Cloud SaaS Backup',
    categoryIcon: '🌩️',
    pillar: 'BACKUP',
    question: 'Your company uses a SaaS CRM. After a data loss incident, the SaaS vendor says they don\'t backup your data. Who is responsible?',
    options: [
      'The SaaS vendor — they host the data',
      'Your organisation — under the Cloud Shared Responsibility Model',
      'The government regulator should mandate it',
      'No one — data loss is an accepted cloud risk',
    ],
    correctIndex: 1,
    explanation: 'Under the Cloud Shared Responsibility Model, backing up your data stored in SaaS applications is YOUR organisation\'s responsibility.',
  },
  // --- RESPOND ---
  {
    id: 'a24',
    category: 'Incident Response',
    categoryIcon: '🚨',
    pillar: 'RESPOND',
    question: 'Why should an incident response plan involve multiple departments and stakeholders?',
    options: [
      'So that no single person can be blamed for the breach',
      'So every function knows their role BEFORE an incident, enabling faster coordinated response',
      'Regulations require sign-off from all departments',
      'IT alone can handle all cyber incidents',
    ],
    correctIndex: 1,
    explanation: 'Different functions have different roles — IT isolates systems, Legal assesses PDPA obligations, Comms manages reputation, Business leaders decide on ransom. Rehearsing prepares everyone.',
  },
];


export interface QuestScenario {
  id: string;
  label: string;
  icon: string;
  subtitle: string;
  impact: string;
  description: string;
  roles: QuestRole[];
  protectionTips: string[];
  aiEdition?: boolean;
}

export interface QuestRole {
  role: string;
  icon: string;
  tasks: string[];
}

export const CYBER_QUEST_SCENARIOS: QuestScenario[] = [
  {
    id: 'A',
    label: 'Ransomware',
    icon: '🔒',
    subtitle: 'Business disruption & reputational damage',
    impact: 'Threat actors exploited unpatched software to enter the corporate environment and demand ransom to "unlock" company data.',
    description: 'A wholesale company issues corporate devices to all employees with software updates turned on. Employees were busy with project deadlines and delayed installing key software updates. Threat actors exploited unpatched vulnerabilities and gained access to sensitive customer contract information. Finance employees could not open their files and received a ransom email. When they didn\'t respond, attackers threatened to publish the data on the dark web.',
    roles: [
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Isolate affected systems — disconnect Ethernet, disable WiFi/Bluetooth',
          'Visit https://www.nomoreransom.org to check for a decryptor',
          'Do NOT pay the ransom — data may not be decrypted and you become a soft target',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Lodge a police report and report to SingCERT',
          'Strongly discourage any ransom payment',
          'Allocate resources for employee cybersecurity awareness',
        ],
      },
      {
        role: 'Employee Involved in Breach',
        icon: '👤',
        tasks: [
          'Work with IT to recover data from separately-stored backups',
          'Resume normal operations only when IT confirms systems are clean',
        ],
      },
      {
        role: 'Communications / Sales',
        icon: '📢',
        tasks: [
          'Assess likelihood and impact if incident becomes public',
          'If necessary, proactively notify customers',
        ],
      },
    ],
    protectionTips: [
      'Update software promptly — prioritise critical security patches',
      'Backup data regularly and store backups SEPARATELY from operating environment',
      'Test data restoration from backups regularly',
      'Secure administrator accounts to prevent lateral movement',
      'Include ransomware scenarios in your incident response plan',
    ],
  },
  {
    id: 'B',
    label: 'Social Engineering',
    icon: '🎭',
    subtitle: 'Unauthorised access from credential theft',
    impact: 'Employees fell for a phishing attack, leading to credential theft and unauthorised access to personal data.',
    description: 'A logistics company employee received an email from "HR" asking them to review employee benefits on the company portal. The employee clicked the link and logged in — but it was a credential-stealing site designed to look like HR. Attackers now had the employee\'s credentials and used them to access the company\'s employee data systems.',
    roles: [
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Reset the compromised password IMMEDIATELY',
          'Change the password for any other accounts where it was reused',
          'Check for data tampering or loss — restore from backups if needed',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Allocate resources for employee cybersecurity awareness training',
          'Plan for Multi-Factor Authentication (MFA) on key accounts',
          'Schedule annual refresher trainings for all staff',
        ],
      },
      {
        role: 'Data Protection Officer (DPO)',
        icon: '📋',
        tasks: [
          'Assess if this is a notifiable data breach under PDPA',
          'Report to Personal Data Protection Commission (PDPC) if required',
        ],
      },
      {
        role: 'Communications Personnel',
        icon: '📢',
        tasks: [
          'Assess extent of impact to customers',
          'Develop a crisis communications plan if the impact is major',
        ],
      },
    ],
    protectionTips: [
      'Use strong unique passphrases for every account',
      'Enable Multi-Factor Authentication (MFA) as an extra protection layer',
      'Use a trusted password manager',
      'Train employees on social engineering tactics — it is the #2 cyber incident type in Singapore',
      'Include social engineering in the incident response plan',
    ],
  },
  {
    id: 'C',
    label: 'Deepfake',
    icon: '🎭',
    subtitle: 'Financial loss from AI-generated impersonation',
    impact: 'An employee was tricked by a deepfake CEO into transferring a large sum to cybercriminals.',
    description: 'An employee at an advertising firm was contacted by who appeared to be their CEO to join an online meeting. In the meeting, the CEO instructed them to transfer a large sum to a new business partner. The voice sounded exactly like the CEO, and the meeting invite used the CEO\'s photo. The employee complied — but it was a deepfake created from publicly available images and audio recordings of the CEO.',
    roles: [
      {
        role: 'Employee Who Was Tricked',
        icon: '👤',
        tasks: [
          'Hang up and call the real CEO on their known number to verify',
          'In future: ask the caller a personal question only they would know',
          'Limit public video/audio recordings of yourself online',
        ],
      },
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Implement offline verification processes for high-value transactions',
          'Explore watermarks or digital signatures on important media',
          'Train staff on AI-enabled social engineering attacks',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Advise senior management to limit sharing public info (e.g. when overseas)',
          'Allocate resources for AI-enabled threat awareness training',
        ],
      },
      {
        role: 'Communications Personnel',
        icon: '📢',
        tasks: [
          'Explore watermarks or digital signatures on important media assets',
          'Develop strategy to protect corporate brand from impersonation',
        ],
      },
    ],
    protectionTips: [
      'Always verify high-value instructions via a second channel (call back on known number)',
      'Ask the caller questions only they would know the answer to',
      'Limit public audio and video recordings (social media, voicemail)',
      'Implement AI-enabled threat awareness training for all employees',
    ],
  },
  {
    id: 'D',
    label: 'Supply Chain Attack',
    icon: '🔗',
    subtitle: 'Data loss through a compromised vendor',
    impact: 'A trusted CRM vendor was hacked, exposing a coffee company\'s customer data to cybercriminals.',
    description: 'A specialty coffee company runs a loyalty programme using a CRM vendor. One day, the CRM vendor notified them that their database had been hacked — exposing the coffee company\'s customer names, addresses, credit card information and purchase history. The media published the news. The coffee company had not been hacked directly — they were victims of their vendor\'s breach.',
    roles: [
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Assess the vendor\'s cybersecurity practices when selecting vendors',
          'Develop minimum cybersecurity requirements for all key vendors',
          'Review vendor cybersecurity posture to manage supply chain risk',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Inform all key business partners about the incident and actions taken',
          'Assess the need for a PR agency to manage crisis communications',
        ],
      },
      {
        role: 'Data Protection Officer (DPO)',
        icon: '📋',
        tasks: [
          'Assess the number of customers and records affected',
          'Notify PDPC within 3 calendar days of confirming a data breach',
        ],
      },
      {
        role: 'Communications / Sales',
        icon: '📢',
        tasks: [
          'Notify customers proactively about the breach and steps taken',
          'Communicate the measures to prevent future occurrences',
        ],
      },
    ],
    protectionTips: [
      'Vet vendors\' cybersecurity practices before engagement',
      'Set minimum cybersecurity requirements for all key vendors',
      'Train staff on supply chain attack risks',
      'Include supply chain attacks in the incident response plan',
    ],
  },
  {
    id: 'E',
    label: 'Cloud Misconfiguration',
    icon: '☁️',
    subtitle: 'Data leakage from poor cloud security settings',
    impact: 'A weak testing password was never changed after go-live, allowing attackers to access the cloud database.',
    description: 'A logistics company was testing a new cloud inventory system. The manager used a simple password for convenience during testing and forgot to change it after go-live. MFA was never enabled. A threat actor compromised the simple password and gained unauthorised access to the company\'s inventory data in the cloud.',
    roles: [
      {
        role: 'Employee Involved',
        icon: '👤',
        tasks: [
          'Change all simple/default passwords to strong passphrases immediately',
          'Enable Multi-Factor Authentication (MFA)',
          'Check for data tampering — restore from backups if needed',
        ],
      },
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Review all cloud configurations — defaults are for usability, not security',
          'Implement mandatory MFA for all cloud services',
          'Equip employees with cloud security knowledge including shared responsibility model',
        ],
      },
      {
        role: 'Data Protection Officer (DPO)',
        icon: '📋',
        tasks: [
          'Assess if this is a notifiable data breach under PDPA',
          'Report to PDPC if required',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Demonstrate cybersecurity leadership by being aware of cloud security best practices',
          'Allocate resources for cloud security awareness training',
        ],
      },
    ],
    protectionTips: [
      'Change all default passwords before going live',
      'Always enable MFA on cloud services',
      'Review default configurations — they are often NOT secure',
      'Cloud misconfiguration is a top-5 cyber incident in Singapore (CSA 2024)',
    ],
  },
  {
    id: 'F',
    label: 'Shadow AI',
    icon: '👻',
    subtitle: 'IP and confidential data exposed via unapproved AI tools',
    impact: 'An employee submitted a confidential client contract to an unapproved AI tool, unintentionally exposing the company\'s data.',
    description: 'A sales employee entered a confidential client contract into a third-party AI tool (not whitelisted for corporate use) to summarise key points. The AI provider\'s terms allow using submitted data for training. The employee missed a toggle to disable this. The company\'s confidential information was exposed and made accessible to non-authorised parties.',
    roles: [
      {
        role: 'Employee Involved',
        icon: '👤',
        tasks: [
          'Report the incident to your IT or cybersecurity team immediately',
          'Stop using the unapproved AI tool',
        ],
      },
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Develop acceptable use policies for AI tools — ensure employees are aware',
          'Explore Data Loss Prevention (DLP) tools to minimise exposure',
          'Whitelist approved AI tools for corporate use',
        ],
      },
      {
        role: 'Data Protection Officer (DPO)',
        icon: '📋',
        tasks: [
          'Assess if this is a notifiable data breach under PDPA',
          'Report to PDPC if required',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Balance productivity gains from AI with secure AI use',
          'Explore feasibility of whitelisting designated AI tools',
          'Include Shadow AI topics in cybersecurity awareness training',
        ],
      },
    ],
    protectionTips: [
      'Always check if an AI tool is approved/whitelisted before using corporate data',
      'Read the terms of service — does the provider use your data for training?',
      'ChatGPT public queries are now indexed by Google — treat inputs as potentially public',
      'IBM 2025: 20% of breached orgs suffered due to Shadow AI incidents',
    ],
  },
  {
    id: 'G',
    label: 'AI & Data Leakage',
    icon: '🔓',
    subtitle: 'Personal data exposed via AI tool vulnerability',
    impact: 'A vulnerability in an HR company\'s AI recommendation tool allowed prompt injection to extract personal data.',
    description: 'An HR company provides an AI recommendation tool where employers post jobs and job seekers submit resumes. Security researchers discovered that a specific sequence of prompts could trick the AI into outputting personal data from the system. This vulnerability could have led to large-scale data leakage of users\' personal information.',
    roles: [
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Implement AI incident reporting by users of the AI tool',
          'Assess the AI provider\'s cybersecurity posture and track record',
          'Implement LLM firewalls for protection from prompt injection',
          'Ensure AI tool patches are applied promptly',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Set direction to build a strong cybersecurity foundation',
          'Adopt a risk-based approach to implementing AI tools',
        ],
      },
      {
        role: 'Data Protection Officer (DPO)',
        icon: '📋',
        tasks: [
          'Assess if this is a notifiable data breach under PDPA',
          'Report to PDPC if required',
        ],
      },
      {
        role: 'Communications / Sales',
        icon: '📢',
        tasks: [
          'Assess impact and notify customers proactively if needed',
          'Develop crisis communications strategy',
        ],
      },
    ],
    protectionTips: [
      'Review the AI provider\'s security posture before adopting AI tools',
      'Implement LLM firewalls to guard against prompt injection',
      'Apply AI tool software updates and patches promptly',
      'Train staff on secure use of AI, including data governance',
    ],
    aiEdition: true,
  },
  {
    id: 'H',
    label: 'AI Manipulation & Hallucination',
    icon: '🌀',
    subtitle: 'Revenue loss from AI chatbot manipulation',
    impact: 'Users manipulated a travel company\'s AI chatbot into accepting $100 for a full travel package.',
    description: 'A travel company launched a generative AI chatbot for online customer queries. Users quickly found they could manipulate the chatbot with crafted prompts. One user tricked the chatbot into accepting $100 for a full travel package. Others found the chatbot returned wrong prices compared to the static website. Similar to the GM Chevy Tahoe sold for $1 case.',
    roles: [
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Implement AI incident reporting for users of the chatbot',
          'Implement LLM firewalls for protection from manipulation',
          'Review the AI provider\'s security posture and track record',
          'Apply AI updates and patches promptly',
        ],
      },
      {
        role: 'Business Leader / Owner',
        icon: '👔',
        tasks: [
          'Adopt a risk-based approach to implementing AI',
          'Explore feasibility of implementing human verification for high-value transactions',
          'Allocate resources for cybersecurity and AI awareness training',
        ],
      },
      {
        role: 'Communications Personnel',
        icon: '📢',
        tasks: [
          'Develop a communications strategy to manage customer reactions',
          'Prepare to handle backlash from affected customers',
        ],
      },
      {
        role: 'Legal Personnel',
        icon: '⚖️',
        tasks: [
          'Craft a disclaimer on the use of AI indicating possibility of unintended outcomes',
          'Assess potential regulatory risks from AI incidents',
        ],
      },
    ],
    protectionTips: [
      'Implement LLM firewalls to protect against AI manipulation',
      'Human verification for high-value AI-assisted transactions',
      'Add disclaimers about AI use and potential unintended outcomes',
      'Train employees on AI limitations and hallucination risks',
    ],
    aiEdition: true,
  },
  {
    id: 'I',
    label: 'Access Keys for Cloud-Based AI',
    icon: '🗝️',
    subtitle: 'Exposed AI access keys put company data at risk',
    impact: 'A developer stored AI access keys in source code, then reused them across multiple apps — when exposed, all apps and their data were at risk.',
    description: 'A real estate company engaged an app developer to build a cloud-based AI chatbot. The developer stored the AI service access key in the source code. After testing, the chatbot went live. Later, the developer reused the same access key for other external customer-facing applications. The access key was subsequently exposed, putting both internal and external data at risk across ALL applications using the same key.',
    roles: [
      {
        role: 'App Developer',
        icon: '👨‍💻',
        tasks: [
          'Use unique access keys for each application — NEVER share keys',
          'Do NOT store access keys in source code',
          'Use environment variables or secret management services (e.g. AWS Secrets Manager)',
        ],
      },
      {
        role: 'App Development Manager',
        icon: '👔',
        tasks: [
          'Implement cybersecurity awareness training for developers on secure AI key management',
          'Assess the cybersecurity practices of app development vendors',
        ],
      },
      {
        role: 'IT / Cyber Personnel',
        icon: '💻',
        tasks: [
          'Take stock of all access keys used for applications',
          'Protect and rotate access keys regularly',
          'Develop minimum cybersecurity requirements for key vendors',
        ],
      },
      {
        role: 'Communications Personnel',
        icon: '📢',
        tasks: [
          'Develop a communications strategy to engage impacted customers',
          'Prepare to handle reputational damage from the exposure',
        ],
      },
    ],
    protectionTips: [
      'Never store API keys in source code — use environment variables or secrets managers',
      'Use unique access keys per application — shared keys mean shared risk',
      'Regularly rotate and audit access keys',
      'Non-Human Identity (NHI) attacks are on the rise — AI access keys are high-value targets',
    ],
    aiEdition: true,
  },
];

export const POINTS = {
  CYBER_ATTACK: {
    CORRECT_BASE: 1000,
    TIME_BONUS_MAX: 500, // Extra points for speed
  },
  CYBER_QUEST: {
    PARTICIPATED: 500,       // For submitting a response
    FACILITATOR_AWARD: 300, // Facilitator can award bonus points
  },
};

export const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
  '#14b8a6', '#f59e0b', '#10b981', '#3b82f6',
];
