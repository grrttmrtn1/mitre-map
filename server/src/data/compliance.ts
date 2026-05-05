export const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'NIST-CSF-2',
    name: 'NIST Cybersecurity Framework',
    version: '2.0',
    description: 'NIST CSF 2.0 provides guidance for managing and reducing cybersecurity risk across six core functions.',
  },
  {
    id: 'CIS-v8',
    name: 'CIS Controls',
    version: 'v8',
    description: 'CIS Controls v8 is a prioritized set of actions to protect organizations from known cyber attack vectors.',
  },
];

export const COMPLIANCE_CONTROLS = [
  // NIST CSF 2.0 — Govern
  { id: 'CSF-GV.OC-01', framework_id: 'NIST-CSF-2', category: 'GV - Govern', name: 'Organizational Context', description: 'The organizational mission is understood and informs cybersecurity risk management.' },
  { id: 'CSF-GV.RM-01', framework_id: 'NIST-CSF-2', category: 'GV - Govern', name: 'Risk Management Strategy', description: 'Risk management objectives are established and agreed to by organizational stakeholders.' },
  // NIST CSF 2.0 — Identify
  { id: 'CSF-ID.AM-01', framework_id: 'NIST-CSF-2', category: 'ID - Identify', name: 'Asset Inventory', description: 'Inventories of hardware and software assets are maintained.' },
  { id: 'CSF-ID.AM-05', framework_id: 'NIST-CSF-2', category: 'ID - Identify', name: 'Asset Prioritization', description: 'Assets are prioritized based on classification, criticality, and business value.' },
  { id: 'CSF-ID.RA-01', framework_id: 'NIST-CSF-2', category: 'ID - Identify', name: 'Vulnerability Identification', description: 'Vulnerabilities in assets are identified, validated, and recorded.' },
  { id: 'CSF-ID.RA-05', framework_id: 'NIST-CSF-2', category: 'ID - Identify', name: 'Threat Intelligence', description: 'Threats to assets are identified and linked to the organization\'s context.' },
  // NIST CSF 2.0 — Protect
  { id: 'CSF-PR.AA-01', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Identity Management', description: 'Identities and credentials for authorized users, services, and hardware are managed.' },
  { id: 'CSF-PR.AA-02', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Remote Access', description: 'Remote access is managed and only authorized entities have access.' },
  { id: 'CSF-PR.AA-03', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'MFA', description: 'Users, services, and hardware are authenticated.' },
  { id: 'CSF-PR.AA-05', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Access Permissions', description: 'Access permissions are managed, incorporating the principles of least privilege and separation of duties.' },
  { id: 'CSF-PR.AT-01', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Awareness Training', description: 'Personnel are provided with awareness and training so they can perform their cybersecurity-related tasks.' },
  { id: 'CSF-PR.DS-01', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Data at Rest', description: 'The confidentiality, integrity, and availability of data-at-rest are protected.' },
  { id: 'CSF-PR.DS-02', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Data in Transit', description: 'The confidentiality, integrity, and availability of data-in-transit are protected.' },
  { id: 'CSF-PR.PS-01', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Configuration Management', description: 'Configuration management practices are established and applied.' },
  { id: 'CSF-PR.PS-04', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Log Management', description: 'Logs of events are created, protected, and reviewed in accordance with policy.' },
  { id: 'CSF-PR.IR-01', framework_id: 'NIST-CSF-2', category: 'PR - Protect', name: 'Baseline Configuration', description: 'A baseline configuration of hardware and software is created and maintained.' },
  // NIST CSF 2.0 — Detect
  { id: 'CSF-DE.AE-02', framework_id: 'NIST-CSF-2', category: 'DE - Detect', name: 'Event Analysis', description: 'Potentially adverse events are analyzed to better characterize them.' },
  { id: 'CSF-DE.AE-06', framework_id: 'NIST-CSF-2', category: 'DE - Detect', name: 'Incident Declaration', description: 'A process is in place to communicate and report on detected cybersecurity events.' },
  { id: 'CSF-DE.CM-01', framework_id: 'NIST-CSF-2', category: 'DE - Detect', name: 'Network Monitoring', description: 'Networks and network services are monitored to find potentially adverse events.' },
  { id: 'CSF-DE.CM-03', framework_id: 'NIST-CSF-2', category: 'DE - Detect', name: 'Personnel Activity Monitoring', description: 'Personnel activity and technology usage are monitored to find potentially adverse events.' },
  { id: 'CSF-DE.CM-06', framework_id: 'NIST-CSF-2', category: 'DE - Detect', name: 'External Service Monitoring', description: 'External service provider activities are monitored to find potentially adverse events.' },
  // NIST CSF 2.0 — Respond
  { id: 'CSF-RS.AN-03', framework_id: 'NIST-CSF-2', category: 'RS - Respond', name: 'Incident Analysis', description: 'Analysis is performed to establish what has taken place during an incident.' },
  { id: 'CSF-RS.MI-01', framework_id: 'NIST-CSF-2', category: 'RS - Respond', name: 'Incident Containment', description: 'Incidents are contained.' },
  // NIST CSF 2.0 — Recover
  { id: 'CSF-RC.RP-01', framework_id: 'NIST-CSF-2', category: 'RC - Recover', name: 'Recovery Plan', description: 'The recovery portion of the incident response plan is executed once initiated.' },
  // CIS Controls v8
  { id: 'CIS-01', framework_id: 'CIS-v8', category: 'Basic', name: 'Inventory and Control of Enterprise Assets', description: 'Actively manage all enterprise assets connected to the infrastructure.' },
  { id: 'CIS-02', framework_id: 'CIS-v8', category: 'Basic', name: 'Inventory and Control of Software Assets', description: 'Actively manage all software on the network.' },
  { id: 'CIS-03', framework_id: 'CIS-v8', category: 'Basic', name: 'Data Protection', description: 'Develop processes and controls to identify, classify, securely handle, retain, and dispose of data.' },
  { id: 'CIS-04', framework_id: 'CIS-v8', category: 'Basic', name: 'Secure Configuration', description: 'Establish and maintain secure configurations for enterprise assets and software.' },
  { id: 'CIS-05', framework_id: 'CIS-v8', category: 'Basic', name: 'Account Management', description: 'Use processes and tools to assign and manage authorization to credentials for user accounts.' },
  { id: 'CIS-06', framework_id: 'CIS-v8', category: 'Basic', name: 'Access Control Management', description: 'Use processes and tools to create, assign, manage, and revoke access credentials and privileges.' },
  { id: 'CIS-07', framework_id: 'CIS-v8', category: 'Foundational', name: 'Continuous Vulnerability Management', description: 'Develop a plan to continuously assess and track vulnerabilities.' },
  { id: 'CIS-08', framework_id: 'CIS-v8', category: 'Foundational', name: 'Audit Log Management', description: 'Collect, alert, review, and retain audit logs to detect, understand, or recover from an attack.' },
  { id: 'CIS-09', framework_id: 'CIS-v8', category: 'Foundational', name: 'Email and Web Browser Protections', description: 'Improve protections and detections of threats from email and web vectors.' },
  { id: 'CIS-10', framework_id: 'CIS-v8', category: 'Foundational', name: 'Malware Defenses', description: 'Prevent or control the installation, spread, and execution of malicious applications.' },
  { id: 'CIS-11', framework_id: 'CIS-v8', category: 'Foundational', name: 'Data Recovery', description: 'Establish and maintain data recovery practices to restore in-scope enterprise assets to a pre-incident state.' },
  { id: 'CIS-12', framework_id: 'CIS-v8', category: 'Foundational', name: 'Network Infrastructure Management', description: 'Establish and maintain the security of the network infrastructure.' },
  { id: 'CIS-13', framework_id: 'CIS-v8', category: 'Foundational', name: 'Network Monitoring and Defense', description: 'Operate processes and tooling to establish and maintain comprehensive network monitoring and defense.' },
  { id: 'CIS-14', framework_id: 'CIS-v8', category: 'Foundational', name: 'Security Awareness and Skills Training', description: 'Establish and maintain a security awareness program.' },
  { id: 'CIS-16', framework_id: 'CIS-v8', category: 'Organizational', name: 'Application Software Security', description: 'Manage the security life cycle of in-house developed, hosted, or acquired software.' },
  { id: 'CIS-17', framework_id: 'CIS-v8', category: 'Organizational', name: 'Incident Response Management', description: 'Establish a program to develop and maintain an incident response capability.' },
];

export const TECHNIQUE_COMPLIANCE: Array<{ technique_id: string; control_id: string }> = [
  // T1566 Phishing
  { technique_id: 'T1566', control_id: 'CSF-PR.AT-01' },
  { technique_id: 'T1566', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1566', control_id: 'CIS-09' },
  { technique_id: 'T1566', control_id: 'CIS-14' },
  // T1078 Valid Accounts
  { technique_id: 'T1078', control_id: 'CSF-PR.AA-01' },
  { technique_id: 'T1078', control_id: 'CSF-PR.AA-03' },
  { technique_id: 'T1078', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1078', control_id: 'CIS-05' },
  { technique_id: 'T1078', control_id: 'CIS-06' },
  // T1059 Command & Scripting
  { technique_id: 'T1059', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1059', control_id: 'CSF-DE.AE-02' },
  { technique_id: 'T1059', control_id: 'CIS-10' },
  // T1003 OS Credential Dumping
  { technique_id: 'T1003', control_id: 'CSF-PR.AA-01' },
  { technique_id: 'T1003', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1003', control_id: 'CIS-05' },
  { technique_id: 'T1003', control_id: 'CIS-10' },
  // T1021 Remote Services
  { technique_id: 'T1021', control_id: 'CSF-PR.AA-02' },
  { technique_id: 'T1021', control_id: 'CSF-DE.CM-01' },
  { technique_id: 'T1021', control_id: 'CIS-06' },
  { technique_id: 'T1021', control_id: 'CIS-12' },
  // T1190 Exploit Public-Facing Application
  { technique_id: 'T1190', control_id: 'CSF-ID.RA-01' },
  { technique_id: 'T1190', control_id: 'CSF-DE.CM-01' },
  { technique_id: 'T1190', control_id: 'CIS-07' },
  { technique_id: 'T1190', control_id: 'CIS-16' },
  // T1486 Ransomware
  { technique_id: 'T1486', control_id: 'CSF-RC.RP-01' },
  { technique_id: 'T1486', control_id: 'CSF-DE.AE-02' },
  { technique_id: 'T1486', control_id: 'CIS-11' },
  { technique_id: 'T1486', control_id: 'CIS-10' },
  // T1041 Exfiltration over C2
  { technique_id: 'T1041', control_id: 'CSF-PR.DS-02' },
  { technique_id: 'T1041', control_id: 'CSF-DE.CM-01' },
  { technique_id: 'T1041', control_id: 'CIS-03' },
  { technique_id: 'T1041', control_id: 'CIS-13' },
  // T1110 Brute Force
  { technique_id: 'T1110', control_id: 'CSF-PR.AA-01' },
  { technique_id: 'T1110', control_id: 'CSF-PR.AA-03' },
  { technique_id: 'T1110', control_id: 'CIS-05' },
  // T1055 Process Injection
  { technique_id: 'T1055', control_id: 'CSF-DE.AE-02' },
  { technique_id: 'T1055', control_id: 'CIS-10' },
  // T1070 Indicator Removal
  { technique_id: 'T1070', control_id: 'CSF-PR.PS-04' },
  { technique_id: 'T1070', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1070', control_id: 'CIS-08' },
  // T1562 Impair Defenses
  { technique_id: 'T1562', control_id: 'CSF-PR.PS-01' },
  { technique_id: 'T1562', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1562', control_id: 'CIS-04' },
  // T1112 Modify Registry
  { technique_id: 'T1112', control_id: 'CSF-PR.PS-01' },
  { technique_id: 'T1112', control_id: 'CIS-04' },
  // T1547 Boot Autostart
  { technique_id: 'T1547', control_id: 'CSF-PR.PS-01' },
  { technique_id: 'T1547', control_id: 'CIS-04' },
  // T1548 Abuse Elevation
  { technique_id: 'T1548', control_id: 'CSF-PR.AA-05' },
  { technique_id: 'T1548', control_id: 'CIS-06' },
  // T1098 Account Manipulation
  { technique_id: 'T1098', control_id: 'CSF-PR.AA-01' },
  { technique_id: 'T1098', control_id: 'CIS-05' },
  // T1071 App Layer Protocol
  { technique_id: 'T1071', control_id: 'CSF-DE.CM-01' },
  { technique_id: 'T1071', control_id: 'CIS-13' },
  // T1027 Obfuscated Files
  { technique_id: 'T1027', control_id: 'CSF-DE.AE-02' },
  { technique_id: 'T1027', control_id: 'CIS-10' },
  // T1036 Masquerading
  { technique_id: 'T1036', control_id: 'CSF-DE.AE-02' },
  { technique_id: 'T1036', control_id: 'CIS-10' },
  // T1046 Network Service Discovery
  { technique_id: 'T1046', control_id: 'CSF-DE.CM-01' },
  { technique_id: 'T1046', control_id: 'CIS-13' },
  // T1053 Scheduled Task
  { technique_id: 'T1053', control_id: 'CSF-DE.CM-03' },
  { technique_id: 'T1053', control_id: 'CIS-04' },
  // T1557 AITM
  { technique_id: 'T1557', control_id: 'CSF-PR.DS-02' },
  { technique_id: 'T1557', control_id: 'CIS-13' },
  // T1195 Supply Chain
  { technique_id: 'T1195', control_id: 'CSF-ID.RA-05' },
  { technique_id: 'T1195', control_id: 'CIS-02' },
  // T1082 System Info Discovery
  { technique_id: 'T1082', control_id: 'CSF-ID.AM-01' },
  { technique_id: 'T1082', control_id: 'CIS-01' },
  // T1485 Data Destruction
  { technique_id: 'T1485', control_id: 'CSF-RC.RP-01' },
  { technique_id: 'T1485', control_id: 'CIS-11' },
  // T1490 Inhibit Recovery
  { technique_id: 'T1490', control_id: 'CSF-RC.RP-01' },
  { technique_id: 'T1490', control_id: 'CIS-11' },
  // T1133 External Remote
  { technique_id: 'T1133', control_id: 'CSF-PR.AA-02' },
  { technique_id: 'T1133', control_id: 'CIS-12' },
  // T1530 Cloud Storage
  { technique_id: 'T1530', control_id: 'CSF-PR.DS-01' },
  { technique_id: 'T1530', control_id: 'CIS-03' },
  // T1567 Exfil over Web
  { technique_id: 'T1567', control_id: 'CSF-PR.DS-02' },
  { technique_id: 'T1567', control_id: 'CIS-03' },
  { technique_id: 'T1567', control_id: 'CIS-13' },
  // T1566 also DE.AE
  { technique_id: 'T1566', control_id: 'CSF-DE.AE-02' },
];

export const DEMO_TAGS = [
  { name: 'critical-asset', color: '#ef4444', description: 'Detections covering critical infrastructure or assets' },
  { name: 'needs-review', color: '#f97316', description: 'Flagged for analyst review' },
  { name: 'high-fidelity', color: '#22c55e', description: 'Low false positive rate, high confidence' },
  { name: 'ransomware', color: '#dc2626', description: 'Related to ransomware attack chain' },
  { name: 'cloud', color: '#3b82f6', description: 'Cloud environment coverage' },
  { name: 'identity', color: '#8b5cf6', description: 'Identity and access management coverage' },
  { name: 'exfiltration', color: '#f59e0b', description: 'Data exfiltration detection' },
  { name: 'lateral-movement', color: '#06b6d4', description: 'Lateral movement detection' },
];
