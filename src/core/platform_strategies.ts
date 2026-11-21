import {logger} from '../utils/logger';

export interface process_match {
	pid: number;
	extension_port: number;
	/**
	 * CSRF token from the command line. Empty for `agy --hub` builds that publish the
	 * token in their daemon discovery file instead; ProcessFinder fills it in from there.
	 */
	csrf_token: string;
	/** Ports hinted by the command line (e.g. --hub-port); used when the OS port lookup fails. */
	hint_ports: number[];
	/** Full command line, needed to locate the matching hub discovery file. */
	command_line: string;
}

export interface platform_strategy {
	get_process_list_command(process_names: string[]): string;
	/** Fallback discovery by command-line flag, so a renamed binary still gets found. */
	get_commandline_search_command(): string;
	parse_process_info(stdout: string): process_match | null;
	get_port_list_command(pid: number): string;
	parse_listening_ports(stdout: string, pid: number): number[];
	get_error_messages(): {process_not_found: string; command_not_available: string; requirements: string[]};
}

/**
 * Extract the --hub-port from the agy hub command line.
 */
function extract_hint_ports(command_line: string): number[] {
	const ports: number[] = [];

	const hub_match = command_line.match(/--hub[-_]port[=\s]+(\d+)/);
	if (hub_match) {
		ports.push(parseInt(hub_match[1], 10));
	}

	return ports;
}

/**
 * `agy --hub` runs without --csrf_token on recent builds; the token lives in the
 * daemon discovery file instead (see hub_discovery.ts).
 */
function is_hub_command_line(command_line: string): boolean {
	return /(?:^|\s)--hub(?=\s|$)/i.test(command_line) || /--hub[-_]port[=\s]+\d+/i.test(command_line);
}

/**
 * Build a match from a pid + command line. Token-less hub processes are kept so
 * ProcessFinder can resolve their token from the discovery file; anything else
 * without a token cannot authenticate and is dropped.
 */
function build_match(pid: number, command_line: string, strategy_name: string): process_match | null {
	if (!pid || isNaN(pid)) {
		return null;
	}

	const is_hub = is_hub_command_line(command_line);
	const hint_ports = extract_hint_ports(command_line);
	const token_match = command_line.match(/--csrf_token[=\s]+([a-zA-Z0-9\-]+)/);
	const csrf_token = token_match?.[1] ?? '';

	if (!csrf_token && !is_hub) {
		logger.debug(strategy_name, `PID ${pid} has no CSRF token, skipping`);
		return null;
	}

	if (!csrf_token) {
		logger.debug(
			strategy_name,
			`PID ${pid} is an agy hub without a command-line CSRF token; will read it from the daemon discovery file`
		);
	}

	return {
		pid,
		extension_port: hint_ports.length > 0 ? hint_ports[0] : 0,
		csrf_token,
		hint_ports,
		command_line,
	};
}

export class WindowsStrategy implements platform_strategy {
	private use_powershell: boolean = true;

	set_use_powershell(use: boolean) {
		this.use_powershell = use;
	}

	is_using_powershell(): boolean {
		return this.use_powershell;
	}

	/**
	 * Determine if a command line belongs to an Antigravity process.
	 * Checks for --app_data_dir antigravity parameter or antigravity in the path.
	 */
	private is_antigravity_process(command_line: string): boolean {
		const lower_cmd = command_line.toLowerCase();

		// Accepts both `--app_data_dir antigravity` and `--app_data_dir=antigravity`.
		if (/--app[_-]data[_-]dir[=\s]+"?antigravity\b/i.test(command_line)) {
			logger.debug('WindowsStrategy', `Process identified as Antigravity (--app_data_dir match)`);
			return true;
		}

		if (lower_cmd.includes('\\antigravity\\') || lower_cmd.includes('/antigravity/')) {
			logger.debug('WindowsStrategy', `Process identified as Antigravity (path match)`);
			return true;
		}

		logger.debug('WindowsStrategy', `Process is NOT Antigravity`);
		return false;
	}

	get_process_list_command(process_names: string[]): string {
		const name_filter = process_names.map(n => `name='${n}'`).join(' OR ');
		if (this.use_powershell) {
			return `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"${name_filter}\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
		}
		return `wmic process where "${name_filter}" get ProcessId,CommandLine /format:list`;
	}

	get_commandline_search_command(): string {
		if (this.use_powershell) {
			return `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"CommandLine LIKE '%app_data_dir=antigravity%'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
		}
		return `wmic process where "CommandLine like '%app_data_dir=antigravity%'" get ProcessId,CommandLine /format:list`;
	}

	parse_process_info(stdout: string): process_match | null {
		logger.debug('WindowsStrategy', `Parsing process info (using PowerShell: ${this.use_powershell})`);

		if (this.use_powershell || stdout.trim().startsWith('{') || stdout.trim().startsWith('[')) {
			logger.debug('WindowsStrategy', `Detected JSON output, parsing...`);

			try {
				let data = JSON.parse(stdout.trim());

				if (Array.isArray(data)) {
					logger.debug('WindowsStrategy', `JSON is an array with ${data.length} element(s)`);

					if (data.length === 0) {
						logger.warn('WindowsStrategy', `Empty process array - no agy processes found`);
						return null;
					}

					const total_count = data.length;

					for (let i = 0; i < data.length; i++) {
						const item = data[i];
						logger.debug('WindowsStrategy', `Process ${i + 1}/${total_count}: PID=${item.ProcessId}`);
						logger.debug('WindowsStrategy', `  CommandLine: ${item.CommandLine ? item.CommandLine.substring(0, 200) + '...' : '(empty)'}`);
					}

					const antigravity_processes = data.filter((item: any) => item.CommandLine && this.is_antigravity_process(item.CommandLine));

					logger.info('WindowsStrategy', `Found ${total_count} agy process(es), ${antigravity_processes.length} belong to Antigravity`);

					if (antigravity_processes.length === 0) {
						logger.warn('WindowsStrategy', `No Antigravity process found among ${total_count} agy process(es)`);
						logger.debug('WindowsStrategy', `Hint: Looking for processes with '--app_data_dir antigravity' or '\\antigravity\\' in path`);
						return null;
					}

					const match = this.pick_candidate(antigravity_processes);
					if (!match) {
						return null;
					}
					logger.info('WindowsStrategy', `Selected Antigravity process PID: ${match.pid}`);
					return match;
				}

				logger.debug('WindowsStrategy', `JSON is a single object (PID: ${data.ProcessId})`);
				logger.debug('WindowsStrategy', `CommandLine: ${data.CommandLine ? data.CommandLine.substring(0, 200) + '...' : '(empty)'}`);

				if (!data.CommandLine || !this.is_antigravity_process(data.CommandLine)) {
					logger.warn('WindowsStrategy', `Single process found but not Antigravity, skipping`);
					return null;
				}

				const match = build_match(data.ProcessId, data.CommandLine, 'WindowsStrategy');
				if (!match) {
					logger.warn('WindowsStrategy', `CSRF token not found in command line`);
					logger.debug('WindowsStrategy', `Full command line: ${data.CommandLine}`);
					return null;
				}

				logger.info('WindowsStrategy', `Found 1 Antigravity process, PID: ${match.pid}`);
				return match;
			} catch (e: any) {
				logger.error('WindowsStrategy', `JSON parse error: ${e.message}`);
				logger.debug('WindowsStrategy', `Raw stdout (first 500 chars): ${stdout.substring(0, 500)}`);
			}
		}
		const blocks = stdout.split(/\n\s*\n/).filter(block => block.trim().length > 0);

		logger.debug('WindowsStrategy', `Fallback: Processing WMIC output with ${blocks.length} block(s)`);

		const candidates: {pid: number; command_line: string}[] = [];

		for (const block of blocks) {
			const pid_match = block.match(/ProcessId=(\d+)/);
			const command_line_match = block.match(/CommandLine=(.+)/);

			if (!pid_match || !command_line_match) {
				logger.debug('WindowsStrategy', `WMIC block skipped: missing PID or CommandLine`);
				continue;
			}

			const command_line = command_line_match[1].trim();
			logger.debug('WindowsStrategy', `WMIC: Checking PID ${pid_match[1]}`);

			if (!this.is_antigravity_process(command_line)) {
				continue;
			}

			candidates.push({pid: parseInt(pid_match[1], 10), command_line});
		}

		if (candidates.length === 0) {
			logger.warn('WindowsStrategy', `WMIC: No Antigravity process found`);
			return null;
		}

		const match = this.pick_candidate(candidates);
		if (!match) {
			logger.warn('WindowsStrategy', `WMIC: No usable Antigravity process found`);
			return null;
		}

		logger.info('WindowsStrategy', `WMIC: Found ${candidates.length} Antigravity process(es), using PID: ${match.pid}`);
		return match;
	}

	/**
	 * Prefer a process whose CSRF token is already on the command line, then fall back
	 * to a token-less hub process (its token comes from the discovery file).
	 */
	private pick_candidate(items: {ProcessId?: number; ProcessID?: number; pid?: number; CommandLine?: string; command_line?: string}[]): process_match | null {
		const matches: process_match[] = [];

		for (const item of items) {
			const pid = item.ProcessId ?? item.ProcessID ?? item.pid;
			const command_line = item.CommandLine ?? item.command_line ?? '';
			if (!pid || !command_line) {
				continue;
			}
			const match = build_match(pid, command_line, 'WindowsStrategy');
			if (match) {
				matches.push(match);
			}
		}

		if (matches.length === 0) {
			return null;
		}

		return matches.find(m => m.csrf_token.length > 0) ?? matches[0];
	}

	get_port_list_command(pid: number): string {
		if (this.use_powershell) {
			return `powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen | Select-Object -ExpandProperty LocalPort | ConvertTo-Json"`;
		}
		return `netstat -ano | findstr "${pid}"`;
	}

	parse_listening_ports(stdout: string, pid: number): number[] {
		const ports: number[] = [];
		if (this.use_powershell) {
			try {
				const data = JSON.parse(stdout.trim());
				if (Array.isArray(data)) {
					for (const port of data) {
						if (typeof port === 'number' && !ports.includes(port)) {
							ports.push(port);
						}
					}
				} else if (typeof data === 'number') {
					ports.push(data);
				}
			} catch (e) {
				// Fallback or ignore parse errors (e.g. empty output)
			}
			return ports.sort((a, b) => a - b);
		}

		const port_regex = new RegExp(`(?:127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1?\\]):(\\d+)\\s+(?:0\\.0\\.0\\.0:0|\\[::\\]:0|\\*:\\*).*?\\s+${pid}$`, 'gim');
		let match;

		while ((match = port_regex.exec(stdout)) !== null) {
			const port = parseInt(match[1], 10);
			if (!ports.includes(port)) {
				ports.push(port);
			}
		}

		return ports.sort((a, b) => a - b);
	}

	get_error_messages() {
		return {
			process_not_found: 'agy process not found',
			command_not_available: this.use_powershell
				? 'PowerShell command failed; please check system permissions'
				: 'wmic/PowerShell command unavailable; please check the system environment',
			requirements: [
				'Antigravity is running',
				'agy.exe process is running',
				this.use_powershell
					? 'The system has permission to run PowerShell commands (Get-CimInstance, Get-NetTCPConnection)'
					: 'The system has permission to run wmic/PowerShell and netstat commands (auto-fallback supported)',
			],
		};
	}
}

export class UnixStrategy implements platform_strategy {
	private platform: string;
	constructor(platform: string) {
		this.platform = platform;
	}

	get_process_list_command(process_names: string[]): string {
		// LC_ALL=C avoids pgrep aborting on invalid UTF-8 in unrelated process args (macOS Sequoia+).
		const pattern = process_names.join('|');
		if (this.platform === 'darwin') {
			return `LC_ALL=C pgrep -fl '${pattern}'`;
		}
		return `LC_ALL=C pgrep -af '${pattern}'`;
	}

	get_commandline_search_command(): string {
		return `ps -axo pid=,command= 2>/dev/null | LC_ALL=C grep -- 'app_data_dir.antigravity' | grep -v grep`;
	}

	/**
	 * Determine if a command line belongs to an Antigravity process.
	 * Checks for --app_data_dir antigravity parameter or antigravity in the path.
	 */
	private is_antigravity_process(command_line: string): boolean {
		const lower_cmd = command_line.toLowerCase();

		// Accepts both `--app_data_dir antigravity` and `--app_data_dir=antigravity`.
		if (/--app[_-]data[_-]dir[=\s]+"?antigravity\b/i.test(command_line)) {
			logger.debug('UnixStrategy', `Process identified as Antigravity (--app_data_dir match)`);
			return true;
		}

		if (lower_cmd.includes('\\antigravity\\') || lower_cmd.includes('/antigravity/')) {
			logger.debug('UnixStrategy', `Process identified as Antigravity (path match)`);
			return true;
		}

		logger.debug('UnixStrategy', `Process is NOT Antigravity`);
		return false;
	}

	parse_process_info(stdout: string): process_match | null {
		const lines = stdout.split('\n').filter(line => line.trim().length > 0);
		const candidates: process_match[] = [];

		for (const raw_line of lines) {
			// `ps` pads PID with leading spaces, so always work from the trimmed line.
			const line = raw_line.trim();
			const parts = line.split(/\s+/);
			const pid = parseInt(parts[0], 10);
			if (isNaN(pid)) {
				continue;
			}

			const cmd = line.substring(parts[0].length).trim();

			// `agy --hub` always carries one of these; the hub may omit --hub-port when it
			// publishes the port only in its discovery file.
			if (
				!cmd.includes('--hub') &&
				!cmd.includes('--hub-port') &&
				!cmd.includes('--hub_port') &&
				!cmd.includes('--csrf_token')
			) {
				continue;
			}

			if (!this.is_antigravity_process(cmd)) {
				continue;
			}

			const match = build_match(pid, cmd, 'UnixStrategy');
			if (match) {
				candidates.push(match);
			}
		}

		if (candidates.length === 0) {
			logger.warn('UnixStrategy', 'No Antigravity agy process found');
			return null;
		}

		const selected = candidates.find(c => c.csrf_token.length > 0) ?? candidates[0];

		if (candidates.length > 1) {
			logger.info('UnixStrategy', `Found ${candidates.length} Antigravity process(es), using PID: ${selected.pid}`);
		} else {
			logger.info('UnixStrategy', `Found 1 Antigravity process, PID: ${selected.pid}`);
		}

		return selected;
	}

	get_port_list_command(pid: number): string {
		if (this.platform === 'darwin') {
			return `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid}`;
		}
		return `ss -tlnp 2>/dev/null | grep "pid=${pid}" || lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null`;
	}

	parse_listening_ports(stdout: string, pid: number): number[] {
		const ports: number[] = [];
		const lsof_regex = new RegExp(`^\\S+\\s+${pid}\\s+.*?(?:TCP|UDP)\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]+\\]):(\\d+)\\s+\\(LISTEN\\)`, 'gim');

		if (this.platform === 'darwin') {
			let match;
			while ((match = lsof_regex.exec(stdout)) !== null) {
				const port = parseInt(match[1], 10);
				if (!ports.includes(port)) {
					ports.push(port);
				}
			}
		} else {
			const ss_regex = new RegExp(`LISTEN\\s+\\d+\\s+\\d+\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]*\\]):(\\d+).*?users:.*?,pid=${pid},`, 'gi');
			let match;
			while ((match = ss_regex.exec(stdout)) !== null) {
				const port = parseInt(match[1], 10);
				if (!ports.includes(port)) {
					ports.push(port);
				}
			}

			if (ports.length === 0) {
				while ((match = lsof_regex.exec(stdout)) !== null) {
					const port = parseInt(match[1], 10);
					if (!ports.includes(port)) {
						ports.push(port);
					}
				}
			}
		}

		return ports.sort((a, b) => a - b);
	}

	get_error_messages() {
		return {
			process_not_found: 'Process not found',
			command_not_available: 'Command check failed',
			requirements: ['lsof or netstat'],
		};
	}
}
