export const D3FEND_TECHNIQUES = [
  // Harden > Application Hardening
  { id: 'D3-AH', name: 'Application Hardening', category: 'Harden', subcategory: 'Application Hardening', description: 'Making an application more resistant to attack.', url: 'https://d3fend.mitre.org/technique/d3f:ApplicationHardening/' },
  { id: 'D3-SAOR', name: 'Segment Address Offset Randomization', category: 'Harden', subcategory: 'Application Hardening', description: 'Randomizing the base address of executables and shared libraries (ASLR).', url: 'https://d3fend.mitre.org/technique/d3f:SegmentAddressOffsetRandomization/' },
  { id: 'D3-SBV', name: 'Strong Binary Validation', category: 'Harden', subcategory: 'Application Hardening', description: 'Verifying the integrity of software binaries before execution.', url: 'https://d3fend.mitre.org/technique/d3f:StrongBinaryValidation/' },
  { id: 'D3-EH', name: 'Exception Handler Pointer Validation', category: 'Harden', subcategory: 'Application Hardening', description: 'Validates that exception handler pointers are in expected memory regions.', url: 'https://d3fend.mitre.org/technique/d3f:ExceptionHandlerPointerValidation/' },
  // Harden > Credential Hardening
  { id: 'D3-CH', name: 'Credential Hardening', category: 'Harden', subcategory: 'Credential Hardening', description: 'Increasing the strength and resilience of credentials.', url: 'https://d3fend.mitre.org/technique/d3f:CredentialHardening/' },
  { id: 'D3-MFA', name: 'Multi-factor Authentication', category: 'Harden', subcategory: 'Credential Hardening', description: 'Requiring more than one form of authentication before granting access.', url: 'https://d3fend.mitre.org/technique/d3f:Multi-factorAuthentication/' },
  { id: 'D3-OTP', name: 'One-time Password', category: 'Harden', subcategory: 'Credential Hardening', description: 'Using passwords that are valid for only one login session.', url: 'https://d3fend.mitre.org/technique/d3f:One-timePassword/' },
  { id: 'D3-SPP', name: 'Strong Password Policy', category: 'Harden', subcategory: 'Credential Hardening', description: 'Enforcing strong password requirements.', url: 'https://d3fend.mitre.org/technique/d3f:StrongPasswordPolicy/' },
  { id: 'D3-DKPC', name: 'Disk Encryption', category: 'Harden', subcategory: 'Credential Hardening', description: 'Encrypting data at rest on disk.', url: 'https://d3fend.mitre.org/technique/d3f:DiskEncryption/' },
  // Harden > Message Hardening
  { id: 'D3-MH', name: 'Message Hardening', category: 'Harden', subcategory: 'Message Hardening', description: 'Making messages more resistant to interception and spoofing.', url: 'https://d3fend.mitre.org/technique/d3f:MessageHardening/' },
  { id: 'D3-DNSSEC', name: 'DNSSEC', category: 'Harden', subcategory: 'Message Hardening', description: 'Adding cryptographic authentication to DNS records.', url: 'https://d3fend.mitre.org/technique/d3f:DNSSEC/' },
  { id: 'D3-EHPV', name: 'Email Header Protocol Validation', category: 'Harden', subcategory: 'Message Hardening', description: 'Validating email header data to detect spoofed emails.', url: 'https://d3fend.mitre.org/technique/d3f:EmailHeaderProtocolValidation/' },
  { id: 'D3-SFP', name: 'Sender Policy Framework', category: 'Harden', subcategory: 'Message Hardening', description: 'Authenticating sender identity with SPF records.', url: 'https://d3fend.mitre.org/technique/d3f:SenderPolicyFramework/' },
  { id: 'D3-DMARC', name: 'DMARC', category: 'Harden', subcategory: 'Message Hardening', description: 'Domain-based message authentication, reporting and conformance.', url: 'https://d3fend.mitre.org/technique/d3f:DomainMessageAuthenticationReportingConformance/' },
  // Harden > Platform Hardening
  { id: 'D3-PH', name: 'Platform Hardening', category: 'Harden', subcategory: 'Platform Hardening', description: 'Securing the underlying platform configurations.', url: 'https://d3fend.mitre.org/technique/d3f:PlatformHardening/' },
  { id: 'D3-BDI', name: 'Boot Integrity', category: 'Harden', subcategory: 'Platform Hardening', description: 'Assuring the integrity of the boot process.', url: 'https://d3fend.mitre.org/technique/d3f:BootIntegrity/' },
  { id: 'D3-BAI', name: 'BIOS Authentication', category: 'Harden', subcategory: 'Platform Hardening', description: 'Authenticating firmware before loading the OS.', url: 'https://d3fend.mitre.org/technique/d3f:BIOSAuthentication/' },
  { id: 'D3-FH', name: 'File Hash Validation', category: 'Harden', subcategory: 'Platform Hardening', description: 'Verifying file integrity by comparing cryptographic hashes.', url: 'https://d3fend.mitre.org/technique/d3f:FileHashValidation/' },
  { id: 'D3-HBPI', name: 'Hardware-based Process Isolation', category: 'Harden', subcategory: 'Platform Hardening', description: 'Preventing one process from accessing the memory space of another at the hardware level.', url: 'https://d3fend.mitre.org/technique/d3f:Hardware-basedProcessIsolation/' },
  { id: 'D3-DNSAL', name: 'DNS Allowlisting', category: 'Harden', subcategory: 'Platform Hardening', description: 'Allowing only known-good domains to be resolved.', url: 'https://d3fend.mitre.org/technique/d3f:DNSAllowlisting/' },
  // Detect > File Analysis
  { id: 'D3-FA', name: 'File Analysis', category: 'Detect', subcategory: 'File Analysis', description: 'Analyzing files to detect malicious content or behavior.', url: 'https://d3fend.mitre.org/technique/d3f:FileAnalysis/' },
  { id: 'D3-DAA', name: 'Dynamic Analysis', category: 'Detect', subcategory: 'File Analysis', description: 'Executing or opening a file in a controlled environment to detect malicious activity.', url: 'https://d3fend.mitre.org/technique/d3f:DynamicAnalysis/' },
  { id: 'D3-FCR', name: 'File Content Rules', category: 'Detect', subcategory: 'File Analysis', description: 'Applying pattern-matching rules to file contents for known malicious patterns.', url: 'https://d3fend.mitre.org/technique/d3f:FileContentRules/' },
  { id: 'D3-FSRM', name: 'File System Monitoring', category: 'Detect', subcategory: 'File Analysis', description: 'Detecting modifications to the file system.', url: 'https://d3fend.mitre.org/technique/d3f:FileSystemMonitoring/' },
  { id: 'D3-SA', name: 'Emulated File Analysis', category: 'Detect', subcategory: 'File Analysis', description: 'Analyzing files in an emulated environment to detect malicious behavior.', url: 'https://d3fend.mitre.org/technique/d3f:EmulatedFileAnalysis/' },
  // Detect > Identifier Analysis
  { id: 'D3-IPA', name: 'IP Address Analysis', category: 'Detect', subcategory: 'Identifier Analysis', description: 'Analyzing IP addresses to detect suspicious activity.', url: 'https://d3fend.mitre.org/technique/d3f:IPAddressAnalysis/' },
  { id: 'D3-DNSTA', name: 'DNS Traffic Analysis', category: 'Detect', subcategory: 'Identifier Analysis', description: 'Analyzing DNS queries for indicators of compromise.', url: 'https://d3fend.mitre.org/technique/d3f:DNSTrafficAnalysis/' },
  { id: 'D3-URLA', name: 'URL Analysis', category: 'Detect', subcategory: 'Identifier Analysis', description: 'Analyzing URLs to detect malicious links.', url: 'https://d3fend.mitre.org/technique/d3f:URLAnalysis/' },
  // Detect > Network Traffic Analysis
  { id: 'D3-NTA', name: 'Network Traffic Analysis', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Analyzing network traffic to detect malicious activity.', url: 'https://d3fend.mitre.org/technique/d3f:NetworkTrafficAnalysis/' },
  { id: 'D3-HTTPA', name: 'HTTP Traffic Analysis', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Analyzing HTTP traffic for indicators of compromise.', url: 'https://d3fend.mitre.org/technique/d3f:HTTPTrafficAnalysis/' },
  { id: 'D3-TLSA', name: 'TLS Traffic Analysis', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Analyzing TLS traffic for anomalies indicating malicious use.', url: 'https://d3fend.mitre.org/technique/d3f:TLSTrafficAnalysis/' },
  { id: 'D3-NCR', name: 'Network Connection Rules', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Filtering network connections using rules based on known indicators.', url: 'https://d3fend.mitre.org/technique/d3f:NetworkConnectionRules/' },
  { id: 'D3-ANPA', name: 'Protocol Anomaly Detection', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Detecting anomalous protocol usage in network traffic.', url: 'https://d3fend.mitre.org/technique/d3f:ProtocolAnomalyDetection/' },
  { id: 'D3-IDPS', name: 'Network Intrusion Detection', category: 'Detect', subcategory: 'Network Traffic Analysis', description: 'Detecting attacks on network infrastructure.', url: 'https://d3fend.mitre.org/technique/d3f:NetworkIntrusionDetectionSystem/' },
  // Detect > Platform Monitoring
  { id: 'D3-PM', name: 'Platform Monitoring', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Monitoring platform-level telemetry for malicious activity.', url: 'https://d3fend.mitre.org/technique/d3f:PlatformMonitoring/' },
  { id: 'D3-SYSM', name: 'System Monitoring', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Monitoring system-level events and configuration changes.', url: 'https://d3fend.mitre.org/technique/d3f:SystemDaemonMonitoring/' },
  { id: 'D3-APPLOG', name: 'Application Log Analysis', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Analyzing application logs for evidence of attack.', url: 'https://d3fend.mitre.org/technique/d3f:ApplicationLogAnalysis/' },
  { id: 'D3-LFI', name: 'Log File Integrity', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Ensuring log files have not been tampered with.', url: 'https://d3fend.mitre.org/technique/d3f:SystemFileAnalysis/' },
  { id: 'D3-RPEP', name: 'Registry Path Baseline', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Maintaining a baseline of expected registry entries.', url: 'https://d3fend.mitre.org/technique/d3f:SystemConfigurationMonitor/' },
  { id: 'D3-OMBA', name: 'OS API Monitoring', category: 'Detect', subcategory: 'Platform Monitoring', description: 'Monitoring calls to operating system APIs.', url: 'https://d3fend.mitre.org/technique/d3f:SystemCallAnalysis/' },
  // Detect > Process Analysis
  { id: 'D3-PA', name: 'Process Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Analyzing process behavior to detect malicious activity.', url: 'https://d3fend.mitre.org/technique/d3f:ProcessAnalysis/' },
  { id: 'D3-PSEP', name: 'Process Spawn Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Detecting unusual child process creation.', url: 'https://d3fend.mitre.org/technique/d3f:ProcessSpawnAnalysis/' },
  { id: 'D3-PTBA', name: 'Process Tree Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Analyzing parent-child process relationships.', url: 'https://d3fend.mitre.org/technique/d3f:ProcessTreeAnalysis/' },
  { id: 'D3-PRAT', name: 'Process Argument Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Analyzing process command-line arguments for suspicious patterns.', url: 'https://d3fend.mitre.org/technique/d3f:ProcessCodeSegmentVerification/' },
  { id: 'D3-SWA', name: 'Script Execution Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Analyzing script content and execution patterns.', url: 'https://d3fend.mitre.org/technique/d3f:ScriptExecutionAnalysis/' },
  { id: 'D3-PLA', name: 'Process Lineage Analysis', category: 'Detect', subcategory: 'Process Analysis', description: 'Analyzing the chain of process creation events.', url: 'https://d3fend.mitre.org/technique/d3f:ProcessLineageAnalysis/' },
  // Detect > User Behavior Analysis
  { id: 'D3-UBA', name: 'User Behavior Analysis', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'Analyzing user behavior to detect anomalous activity.', url: 'https://d3fend.mitre.org/technique/d3f:UserBehaviorAnalysis/' },
  { id: 'D3-AAPA', name: 'Account Access Baseline', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'Establishing normal access patterns to detect deviations.', url: 'https://d3fend.mitre.org/technique/d3f:AccountLoginPatternAnalysis/' },
  { id: 'D3-APD', name: 'Authentication Event Analysis', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'Analyzing authentication events for anomalous patterns.', url: 'https://d3fend.mitre.org/technique/d3f:AuthenticationEventThresholdAnalysis/' },
  { id: 'D3-UGLPA', name: 'User Geolocation Analysis', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'Detecting logins from unusual geographic locations.', url: 'https://d3fend.mitre.org/technique/d3f:UserGeolocationLogonPatternAnalysis/' },
  { id: 'D3-UEBA', name: 'UEBA', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'User and Entity Behavior Analytics to detect insider threats and compromised accounts.', url: 'https://d3fend.mitre.org/technique/d3f:UserBehaviorAnalysis/' },
  { id: 'D3-JFAPA', name: 'Job Function Access Analysis', category: 'Detect', subcategory: 'User Behavior Analysis', description: 'Detecting access to resources inconsistent with a user\'s job function.', url: 'https://d3fend.mitre.org/technique/d3f:JobFunctionAccessPatternAnalysis/' },
  // Isolate > Execution Isolation
  { id: 'D3-EI', name: 'Execution Isolation', category: 'Isolate', subcategory: 'Execution Isolation', description: 'Limiting the execution context of code.', url: 'https://d3fend.mitre.org/technique/d3f:ExecutionIsolation/' },
  { id: 'D3-BA', name: 'Browser Isolation', category: 'Isolate', subcategory: 'Execution Isolation', description: 'Running web browser processes in an isolated environment.', url: 'https://d3fend.mitre.org/technique/d3f:BrowserIsolation/' },
  { id: 'D3-CI', name: 'Containerization', category: 'Isolate', subcategory: 'Execution Isolation', description: 'Isolating application components in containers.', url: 'https://d3fend.mitre.org/technique/d3f:Containerization/' },
  { id: 'D3-ECI', name: 'Executable Code Isolation', category: 'Isolate', subcategory: 'Execution Isolation', description: 'Restricting execution to known-good code segments.', url: 'https://d3fend.mitre.org/technique/d3f:ExecutableCodeFiltering/' },
  { id: 'D3-IOBB', name: 'IO Bus Blocking', category: 'Isolate', subcategory: 'Execution Isolation', description: 'Blocking unauthorized devices from connecting via IO buses.', url: 'https://d3fend.mitre.org/technique/d3f:IOPortRestriction/' },
  // Isolate > Network Isolation
  { id: 'D3-NI', name: 'Network Isolation', category: 'Isolate', subcategory: 'Network Isolation', description: 'Limiting network communications to known-good flows.', url: 'https://d3fend.mitre.org/technique/d3f:NetworkIsolation/' },
  { id: 'D3-FW', name: 'Firewall', category: 'Isolate', subcategory: 'Network Isolation', description: 'Using firewall rules to control network traffic.', url: 'https://d3fend.mitre.org/technique/d3f:FirewallRule/' },
  { id: 'D3-NF', name: 'Network Traffic Filtering', category: 'Isolate', subcategory: 'Network Isolation', description: 'Filtering network traffic to prevent malicious flows.', url: 'https://d3fend.mitre.org/technique/d3f:NetworkTrafficFiltering/' },
  { id: 'D3-ET', name: 'Egress Traffic Filtering', category: 'Isolate', subcategory: 'Network Isolation', description: 'Controlling outbound network traffic.', url: 'https://d3fend.mitre.org/technique/d3f:EgressTrafficFiltering/' },
  { id: 'D3-IT', name: 'Ingress Traffic Filtering', category: 'Isolate', subcategory: 'Network Isolation', description: 'Controlling inbound network traffic.', url: 'https://d3fend.mitre.org/technique/d3f:IngressTrafficFiltering/' },
  { id: 'D3-UA', name: 'URL Blocking', category: 'Isolate', subcategory: 'Network Isolation', description: 'Blocking access to malicious or unauthorized URLs.', url: 'https://d3fend.mitre.org/technique/d3f:URLAnalysis/' },
  { id: 'D3-PF', name: 'Port Filtering', category: 'Isolate', subcategory: 'Network Isolation', description: 'Blocking access to specific network ports.', url: 'https://d3fend.mitre.org/technique/d3f:PortIsolation/' },
  { id: 'D3-MARN', name: 'Microsegmentation', category: 'Isolate', subcategory: 'Network Isolation', description: 'Creating fine-grained network segments to limit lateral movement.', url: 'https://d3fend.mitre.org/technique/d3f:Microsegmentation/' },
  { id: 'D3-DNS-D', name: 'DNS Denylisting', category: 'Isolate', subcategory: 'Network Isolation', description: 'Blocking resolution of known-malicious domains.', url: 'https://d3fend.mitre.org/technique/d3f:DNSDenylisting/' },
  // Deceive
  { id: 'D3-DT', name: 'Decoy System', category: 'Deceive', subcategory: 'Decoy Environment', description: 'Creating decoy systems to attract and detect attackers.', url: 'https://d3fend.mitre.org/technique/d3f:DecoySystem/' },
  { id: 'D3-DF', name: 'Decoy File', category: 'Deceive', subcategory: 'Decoy Object', description: 'Planting files that trigger an alert if accessed.', url: 'https://d3fend.mitre.org/technique/d3f:DecoyFile/' },
  { id: 'D3-DA', name: 'Decoy Account', category: 'Deceive', subcategory: 'Decoy Object', description: 'Creating fake accounts to detect unauthorized access.', url: 'https://d3fend.mitre.org/technique/d3f:DecoyUserCredentials/' },
  { id: 'D3-DPD', name: 'Decoy Public DNS Record', category: 'Deceive', subcategory: 'Decoy Object', description: 'Publishing fake DNS records to detect reconnaissance.', url: 'https://d3fend.mitre.org/technique/d3f:DecoyPublicDNSRecord/' },
  // Evict
  { id: 'D3-CRE', name: 'Credential Reset', category: 'Evict', subcategory: 'Credential Eviction', description: 'Forcing password or credential resets to evict adversaries.', url: 'https://d3fend.mitre.org/technique/d3f:CredentialEviction/' },
  { id: 'D3-RK', name: 'Driver Load Integrity Checking', category: 'Evict', subcategory: 'Process Eviction', description: 'Verifying kernel driver integrity and removing unauthorized drivers.', url: 'https://d3fend.mitre.org/technique/d3f:KernelModuleIntegrityMonitoring/' },
];

export const ATTACK_D3FEND: Array<{ attack_id: string; d3fend_id: string }> = [
  // T1059 - Command and Scripting Interpreter
  { attack_id: 'T1059', d3fend_id: 'D3-ECI' },
  { attack_id: 'T1059', d3fend_id: 'D3-SWA' },
  { attack_id: 'T1059', d3fend_id: 'D3-PTBA' },
  { attack_id: 'T1059', d3fend_id: 'D3-PRAT' },
  { attack_id: 'T1059', d3fend_id: 'D3-PSEP' },
  { attack_id: 'T1059', d3fend_id: 'D3-FCR' },
  // T1078 - Valid Accounts
  { attack_id: 'T1078', d3fend_id: 'D3-MFA' },
  { attack_id: 'T1078', d3fend_id: 'D3-AAPA' },
  { attack_id: 'T1078', d3fend_id: 'D3-APD' },
  { attack_id: 'T1078', d3fend_id: 'D3-UEBA' },
  { attack_id: 'T1078', d3fend_id: 'D3-UGLPA' },
  { attack_id: 'T1078', d3fend_id: 'D3-SPP' },
  // T1566 - Phishing
  { attack_id: 'T1566', d3fend_id: 'D3-EHPV' },
  { attack_id: 'T1566', d3fend_id: 'D3-SFP' },
  { attack_id: 'T1566', d3fend_id: 'D3-DMARC' },
  { attack_id: 'T1566', d3fend_id: 'D3-BA' },
  { attack_id: 'T1566', d3fend_id: 'D3-UA' },
  { attack_id: 'T1566', d3fend_id: 'D3-DAA' },
  // T1003 - OS Credential Dumping
  { attack_id: 'T1003', d3fend_id: 'D3-MFA' },
  { attack_id: 'T1003', d3fend_id: 'D3-HBPI' },
  { attack_id: 'T1003', d3fend_id: 'D3-CRE' },
  { attack_id: 'T1003', d3fend_id: 'D3-OMBA' },
  { attack_id: 'T1003', d3fend_id: 'D3-PA' },
  // T1110 - Brute Force
  { attack_id: 'T1110', d3fend_id: 'D3-SPP' },
  { attack_id: 'T1110', d3fend_id: 'D3-MFA' },
  { attack_id: 'T1110', d3fend_id: 'D3-APD' },
  { attack_id: 'T1110', d3fend_id: 'D3-AAPA' },
  // T1190 - Exploit Public-Facing Application
  { attack_id: 'T1190', d3fend_id: 'D3-AH' },
  { attack_id: 'T1190', d3fend_id: 'D3-SAOR' },
  { attack_id: 'T1190', d3fend_id: 'D3-IDPS' },
  { attack_id: 'T1190', d3fend_id: 'D3-ANPA' },
  // T1027 - Obfuscated Files
  { attack_id: 'T1027', d3fend_id: 'D3-DAA' },
  { attack_id: 'T1027', d3fend_id: 'D3-FCR' },
  { attack_id: 'T1027', d3fend_id: 'D3-SA' },
  { attack_id: 'T1027', d3fend_id: 'D3-FSRM' },
  // T1055 - Process Injection
  { attack_id: 'T1055', d3fend_id: 'D3-HBPI' },
  { attack_id: 'T1055', d3fend_id: 'D3-PA' },
  { attack_id: 'T1055', d3fend_id: 'D3-PSEP' },
  { attack_id: 'T1055', d3fend_id: 'D3-ECI' },
  { attack_id: 'T1055', d3fend_id: 'D3-OMBA' },
  // T1046 - Network Service Discovery
  { attack_id: 'T1046', d3fend_id: 'D3-NF' },
  { attack_id: 'T1046', d3fend_id: 'D3-PF' },
  { attack_id: 'T1046', d3fend_id: 'D3-NCR' },
  { attack_id: 'T1046', d3fend_id: 'D3-IDPS' },
  // T1071 - Application Layer Protocol
  { attack_id: 'T1071', d3fend_id: 'D3-TLSA' },
  { attack_id: 'T1071', d3fend_id: 'D3-HTTPA' },
  { attack_id: 'T1071', d3fend_id: 'D3-IDPS' },
  { attack_id: 'T1071', d3fend_id: 'D3-UA' },
  { attack_id: 'T1071', d3fend_id: 'D3-NTA' },
  // T1041 - Exfiltration Over C2
  { attack_id: 'T1041', d3fend_id: 'D3-ET' },
  { attack_id: 'T1041', d3fend_id: 'D3-NF' },
  { attack_id: 'T1041', d3fend_id: 'D3-TLSA' },
  // T1486 - Data Encrypted for Impact (Ransomware)
  { attack_id: 'T1486', d3fend_id: 'D3-DKPC' },
  { attack_id: 'T1486', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1486', d3fend_id: 'D3-PA' },
  // T1021 - Remote Services
  { attack_id: 'T1021', d3fend_id: 'D3-MFA' },
  { attack_id: 'T1021', d3fend_id: 'D3-NF' },
  { attack_id: 'T1021', d3fend_id: 'D3-PF' },
  { attack_id: 'T1021', d3fend_id: 'D3-APD' },
  { attack_id: 'T1021', d3fend_id: 'D3-MARN' },
  // T1548 - Abuse Elevation Control
  { attack_id: 'T1548', d3fend_id: 'D3-HBPI' },
  { attack_id: 'T1548', d3fend_id: 'D3-PA' },
  { attack_id: 'T1548', d3fend_id: 'D3-ECI' },
  { attack_id: 'T1548', d3fend_id: 'D3-OMBA' },
  // T1218 - System Binary Proxy Execution
  { attack_id: 'T1218', d3fend_id: 'D3-PRAT' },
  { attack_id: 'T1218', d3fend_id: 'D3-PTBA' },
  { attack_id: 'T1218', d3fend_id: 'D3-SWA' },
  { attack_id: 'T1218', d3fend_id: 'D3-ECI' },
  // T1105 - Ingress Tool Transfer
  { attack_id: 'T1105', d3fend_id: 'D3-ET' },
  { attack_id: 'T1105', d3fend_id: 'D3-NCR' },
  { attack_id: 'T1105', d3fend_id: 'D3-FH' },
  { attack_id: 'T1105', d3fend_id: 'D3-FCR' },
  // T1562 - Impair Defenses
  { attack_id: 'T1562', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1562', d3fend_id: 'D3-LFI' },
  { attack_id: 'T1562', d3fend_id: 'D3-RPEP' },
  // T1070 - Indicator Removal
  { attack_id: 'T1070', d3fend_id: 'D3-LFI' },
  { attack_id: 'T1070', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1070', d3fend_id: 'D3-SYSM' },
  // T1547 - Boot/Logon Autostart Execution
  { attack_id: 'T1547', d3fend_id: 'D3-BDI' },
  { attack_id: 'T1547', d3fend_id: 'D3-RPEP' },
  { attack_id: 'T1547', d3fend_id: 'D3-FSRM' },
  // T1543 - Create/Modify System Process
  { attack_id: 'T1543', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1543', d3fend_id: 'D3-RPEP' },
  { attack_id: 'T1543', d3fend_id: 'D3-LFI' },
  // T1082 - System Information Discovery
  { attack_id: 'T1082', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1082', d3fend_id: 'D3-PA' },
  // T1053 - Scheduled Task
  { attack_id: 'T1053', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1053', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1053', d3fend_id: 'D3-PA' },
  // T1047 - WMI
  { attack_id: 'T1047', d3fend_id: 'D3-PA' },
  { attack_id: 'T1047', d3fend_id: 'D3-PTBA' },
  { attack_id: 'T1047', d3fend_id: 'D3-OMBA' },
  // T1036 - Masquerading
  { attack_id: 'T1036', d3fend_id: 'D3-FH' },
  { attack_id: 'T1036', d3fend_id: 'D3-FCR' },
  { attack_id: 'T1036', d3fend_id: 'D3-SBV' },
  // T1112 - Modify Registry
  { attack_id: 'T1112', d3fend_id: 'D3-RPEP' },
  { attack_id: 'T1112', d3fend_id: 'D3-SYSM' },
  // T1098 - Account Manipulation
  { attack_id: 'T1098', d3fend_id: 'D3-AAPA' },
  { attack_id: 'T1098', d3fend_id: 'D3-APD' },
  { attack_id: 'T1098', d3fend_id: 'D3-UEBA' },
  // T1557 - Adversary-in-the-Middle
  { attack_id: 'T1557', d3fend_id: 'D3-TLSA' },
  { attack_id: 'T1557', d3fend_id: 'D3-DNSSEC' },
  { attack_id: 'T1557', d3fend_id: 'D3-ANPA' },
  // T1573 - Encrypted Channel
  { attack_id: 'T1573', d3fend_id: 'D3-TLSA' },
  { attack_id: 'T1573', d3fend_id: 'D3-NTA' },
  // T1090 - Proxy
  { attack_id: 'T1090', d3fend_id: 'D3-NF' },
  { attack_id: 'T1090', d3fend_id: 'D3-ET' },
  { attack_id: 'T1090', d3fend_id: 'D3-IDPS' },
  // T1568 - Dynamic Resolution
  { attack_id: 'T1568', d3fend_id: 'D3-DNSTA' },
  { attack_id: 'T1568', d3fend_id: 'D3-DNSAL' },
  { attack_id: 'T1568', d3fend_id: 'D3-DNS-D' },
  // T1574 - Hijack Execution Flow
  { attack_id: 'T1574', d3fend_id: 'D3-SAOR' },
  { attack_id: 'T1574', d3fend_id: 'D3-ECI' },
  { attack_id: 'T1574', d3fend_id: 'D3-FSRM' },
  // T1134 - Access Token Manipulation
  { attack_id: 'T1134', d3fend_id: 'D3-OMBA' },
  { attack_id: 'T1134', d3fend_id: 'D3-PA' },
  { attack_id: 'T1134', d3fend_id: 'D3-HBPI' },
  // T1558 - Steal or Forge Kerberos Tickets
  { attack_id: 'T1558', d3fend_id: 'D3-CRE' },
  { attack_id: 'T1558', d3fend_id: 'D3-AAPA' },
  { attack_id: 'T1558', d3fend_id: 'D3-APD' },
  // T1485 - Data Destruction
  { attack_id: 'T1485', d3fend_id: 'D3-DKPC' },
  { attack_id: 'T1485', d3fend_id: 'D3-FSRM' },
  // T1490 - Inhibit System Recovery
  { attack_id: 'T1490', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1490', d3fend_id: 'D3-FSRM' },
  // T1219 - Remote Access Software
  { attack_id: 'T1219', d3fend_id: 'D3-NF' },
  { attack_id: 'T1219', d3fend_id: 'D3-NCR' },
  { attack_id: 'T1219', d3fend_id: 'D3-HTTPA' },
  // T1567 - Exfiltration Over Web Service
  { attack_id: 'T1567', d3fend_id: 'D3-ET' },
  { attack_id: 'T1567', d3fend_id: 'D3-UA' },
  { attack_id: 'T1567', d3fend_id: 'D3-TLSA' },
  // T1133 - External Remote Services
  { attack_id: 'T1133', d3fend_id: 'D3-MFA' },
  { attack_id: 'T1133', d3fend_id: 'D3-NF' },
  { attack_id: 'T1133', d3fend_id: 'D3-MARN' },
  // T1087 - Account Discovery
  { attack_id: 'T1087', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1087', d3fend_id: 'D3-UEBA' },
  // T1083 - File and Directory Discovery
  { attack_id: 'T1083', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1083', d3fend_id: 'D3-PA' },
  // T1048 - Exfiltration Over Alternative Protocol
  { attack_id: 'T1048', d3fend_id: 'D3-ET' },
  { attack_id: 'T1048', d3fend_id: 'D3-ANPA' },
  { attack_id: 'T1048', d3fend_id: 'D3-NF' },
  // T1542 - Pre-OS Boot
  { attack_id: 'T1542', d3fend_id: 'D3-BDI' },
  { attack_id: 'T1542', d3fend_id: 'D3-BAI' },
  // T1189 - Drive-by Compromise
  { attack_id: 'T1189', d3fend_id: 'D3-BA' },
  { attack_id: 'T1189', d3fend_id: 'D3-UA' },
  { attack_id: 'T1189', d3fend_id: 'D3-IDPS' },
  // T1499 - Endpoint DoS
  { attack_id: 'T1499', d3fend_id: 'D3-IDPS' },
  { attack_id: 'T1499', d3fend_id: 'D3-NF' },
  // T1555 - Credentials from Password Stores
  { attack_id: 'T1555', d3fend_id: 'D3-DKPC' },
  { attack_id: 'T1555', d3fend_id: 'D3-PA' },
  { attack_id: 'T1555', d3fend_id: 'D3-OMBA' },
  // T1560 - Archive Collected Data
  { attack_id: 'T1560', d3fend_id: 'D3-FSRM' },
  { attack_id: 'T1560', d3fend_id: 'D3-PA' },
  // T1114 - Email Collection
  { attack_id: 'T1114', d3fend_id: 'D3-APPLOG' },
  { attack_id: 'T1114', d3fend_id: 'D3-UEBA' },
  // T1069 - Permission Groups Discovery
  { attack_id: 'T1069', d3fend_id: 'D3-SYSM' },
  { attack_id: 'T1069', d3fend_id: 'D3-PA' },
  // T1040 - Network Sniffing
  { attack_id: 'T1040', d3fend_id: 'D3-TLSA' },
  { attack_id: 'T1040', d3fend_id: 'D3-MARN' },
];
