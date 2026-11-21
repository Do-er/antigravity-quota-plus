/**
 * Process Finder Service
 */

import {exec} from 'child_process';
import {promisify} from 'util';
import * as http from 'http';
import * as https from 'https';
import {WindowsStrategy, UnixStrategy, platform_strategy, process_match} from './platform_strategies';
import {read_hub_discovery, list_hub_discovery_entries, merge_hint_ports, hub_discovery_info} from './hub_discovery';
import * as process from 'process';
import * as vscode from 'vscode';
import {logger} from '../utils/logger';

const exec_async = promisify(exec);

export type server_protocol = 'https' | 'http';

export interface process_info {
	extension_port: number;
	connect_port: number;
	csrf_token: string;
	/** Transport the language server actually answers on. */
	protocol: server_protocol;
}

const LOG_CAT = 'ProcessFinder';

export class ProcessFinder {
	private strategy: platform_strategy;
	private process_names: string[];

	constructor() {
		logger.debug(LOG_CAT, `Initializing ProcessFinder for platform: ${process.platform}, arch: ${process.arch}`);

		if (process.platform === 'win32') {
			this.strategy = new WindowsStrategy();
			this.process_names = ['agy.exe'];
		} else if (process.platform === 'darwin') {
			this.strategy = new UnixStrategy('darwin');
			this.process_names = ['agy'];
		} else {
			this.strategy = new UnixStrategy('linux');
			this.process_names = ['agy'];
		}

		logger.info(LOG_CAT, `Target process names: ${this.process_names.join(', ')}`);
	}

	async detect_process_info(max_retries: number = 1): Promise<process_info | null> {
		logger.section(LOG_CAT, `Starting process detection (max_retries: ${max_retries})`);
		const timer = logger.time_start('detect_process_info');

		for (let i = 0; i < max_retries; i++) {
			logger.debug(LOG_CAT, `Attempt ${i + 1}/${max_retries}`);

			try {
				const cmd = this.strategy.get_process_list_command(this.process_names);
				logger.debug(LOG_CAT, `Executing process list command:\n${cmd}`);

				const {stdout} = await this.exec_search_command(cmd, 'process list');
				let info = stdout ? this.strategy.parse_process_info(stdout) : null;

				if (!info) {
					logger.debug(LOG_CAT, `Name match found nothing usable, trying command-line search...`);
					const fallback_cmd = this.strategy.get_commandline_search_command();
					logger.debug(LOG_CAT, `Executing command-line search:\n${fallback_cmd}`);

					const fallback = await this.exec_search_command(fallback_cmd, 'command-line search');
					info = fallback.stdout ? this.strategy.parse_process_info(fallback.stdout) : null;
				}

				if (info) {
					const result = await this.connect_to_match(info);
					if (result) {
						timer();
						return result;
					}
				} else {
					logger.warn(LOG_CAT, `Failed to parse process info from command output`);
				}

				// Last resort: hubs advertise themselves in ~/.gemini/<app>/daemon/hub_*.json,
				// so a renamed binary or unparsable process list cannot strand the extension.
				if (i === max_retries - 1) {
					const via_hub_file = await this.connect_via_hub_discovery();
					if (via_hub_file) {
						timer();
						return via_hub_file;
					}
				}
			} catch (e: any) {
				logger.error(LOG_CAT, `Attempt ${i + 1} failed with error:`, {
					message: e.message,
					code: e.code,
					killed: e.killed,
					signal: e.signal,
				});

				if (e.stderr) {
					logger.error(LOG_CAT, `Command stderr: ${e.stderr}`);
				}
			}

			if (i < max_retries - 1) {
				logger.debug(LOG_CAT, `Waiting 100ms before retry...`);
				await new Promise(r => setTimeout(r, 100));
			}
		}

		logger.error(LOG_CAT, `Process detection failed after ${max_retries} attempt(s)`);
		timer();
		return null;
	}

	/**
	 * Resolve the CSRF token (command line or daemon discovery file), collect the
	 * candidate ports, then probe them over HTTPS and HTTP until one answers.
	 */
	private async connect_to_match(match: process_match): Promise<process_info | null> {
		const hub = match.csrf_token ? this.try_read_hub_info(match) : read_hub_discovery(match.command_line, match.pid);
		const csrf_token = match.csrf_token || hub?.csrf_token || '';

		if (!csrf_token) {
			logger.warn(
				LOG_CAT,
				`PID ${match.pid} has no CSRF token on its command line and no readable hub discovery file; skipping`
			);
			return null;
		}

		if (!match.csrf_token) {
			logger.info(LOG_CAT, `CSRF token for PID ${match.pid} loaded from hub discovery file`);
		}

		logger.info(LOG_CAT, `Process info parsed successfully:`, {
			pid: match.pid,
			extension_port: match.extension_port,
			csrf_token: `${csrf_token.substring(0, 8)}...`,
		});

		logger.debug(LOG_CAT, `Getting listening ports for PID: ${match.pid}`);
		const os_ports = await this.get_listening_ports(match.pid);
		logger.debug(LOG_CAT, `OS reported ${os_ports.length} listening port(s): [${os_ports.join(', ')}]`);

		// The hub's HTTPS port serves the language-server API; the discovery file names it
		// explicitly, so probe it before anything else.
		const ports: number[] = [];
		const push = (port: number | undefined) => {
			if (port !== undefined && port > 0 && !ports.includes(port)) {
				ports.push(port);
			}
		};
		push(hub?.https_port);
		for (const port of os_ports) {
			push(port);
		}
		for (const port of merge_hint_ports(match.hint_ports, hub)) {
			push(port);
		}

		logger.debug(LOG_CAT, `Probe order: [${ports.join(', ')}]`);

		if (ports.length === 0) {
			logger.warn(LOG_CAT, `No listening ports found for PID ${match.pid}`);
			return null;
		}

		const working = await this.find_working_endpoint(ports, csrf_token);
		if (!working) {
			logger.warn(LOG_CAT, `No ports responded successfully to health check`);
			return null;
		}

		logger.info(LOG_CAT, `SUCCESS: Valid endpoint found: ${working.protocol}://127.0.0.1:${working.port}`);

		return {
			extension_port: match.extension_port,
			connect_port: working.port,
			csrf_token,
			protocol: working.protocol,
		};
	}

	private try_read_hub_info(match: process_match): hub_discovery_info | null {
		try {
			return read_hub_discovery(match.command_line, match.pid);
		} catch {
			return null;
		}
	}

	/**
	 * Probe every live hub discovery file. Used only after process scanning failed.
	 */
	private async connect_via_hub_discovery(): Promise<process_info | null> {
		const entries = list_hub_discovery_entries();
		if (entries.length === 0) {
			logger.debug(LOG_CAT, `No live hub discovery entries to fall back on`);
			return null;
		}

		logger.info(LOG_CAT, `Trying ${entries.length} hub discovery entr(ies) as a fallback`);

		for (const entry of entries) {
			const ports = merge_hint_ports([], entry);
			const working = await this.find_working_endpoint(ports, entry.csrf_token);
			if (working) {
				logger.info(
					LOG_CAT,
					`SUCCESS via discovery file ${entry.file_path}: ${working.protocol}://127.0.0.1:${working.port} (PID ${entry.pid})`
				);
				return {
					extension_port: entry.http_port ?? 0,
					connect_port: working.port,
					csrf_token: entry.csrf_token,
					protocol: working.protocol,
				};
			}
		}

		logger.warn(LOG_CAT, `No hub discovery entry answered the health check`);
		return null;
	}

	/**
	 * Execute a process discovery shell command, treating non-zero exit codes
	 * (such as pgrep/grep returning 1 when no process matches) as empty output
	 * so fallback search strategies can still run.
	 */
	private async exec_search_command(cmd: string, label: string): Promise<{stdout: string; stderr: string}> {
		try {
			const {stdout, stderr} = await exec_async(cmd);
			if (stderr) {
				logger.warn(LOG_CAT, `${label} stderr output: ${stderr}`);
			}
			logger.debug(LOG_CAT, `${label} stdout (${stdout.length} chars):\n${stdout}`);
			return {stdout, stderr};
		} catch (e: any) {
			// pgrep/grep exit with code 1 when nothing matches; still preserve any partial stdout.
			const stdout = typeof e.stdout === 'string' ? e.stdout : '';
			const stderr = typeof e.stderr === 'string' ? e.stderr : '';
			logger.debug(LOG_CAT, `${label} command exited with code ${e.code}: ${e.message}`);
			if (stderr) {
				logger.debug(LOG_CAT, `${label} stderr: ${stderr}`);
			}
			return {stdout, stderr};
		}
	}

	private async get_listening_ports(pid: number): Promise<number[]> {
		try {
			const cmd = this.strategy.get_port_list_command(pid);
			logger.debug(LOG_CAT, `Port list command:\n${cmd}`);

			const {stdout, stderr} = await exec_async(cmd);

			if (stderr) {
				logger.warn(LOG_CAT, `Port list stderr: ${stderr}`);
			}

			logger.debug(LOG_CAT, `Port list stdout (${stdout.length} chars):\n${stdout.substring(0, 500)}${stdout.length > 500 ? '...(truncated)' : ''}`);

			const ports = this.strategy.parse_listening_ports(stdout, pid);
			logger.debug(LOG_CAT, `Parsed ports: [${ports.join(', ')}]`);
			return ports;
		} catch (e: any) {
			logger.error(LOG_CAT, `Failed to get listening ports:`, {
				message: e.message,
				code: e.code,
			});
			// Command-line hints and the discovery file still provide usable ports.
			return [];
		}
	}

	private async find_working_endpoint(ports: number[], csrf_token: string): Promise<{port: number; protocol: server_protocol} | null> {
		for (const port of ports) {
			// The hub serves Connect-RPC over plain HTTP on --hub-port while its TLS
			// sibling speaks HTTPS, and older builds are HTTPS-only. Try both.
			for (const protocol of ['https', 'http'] as server_protocol[]) {
				logger.debug(LOG_CAT, `Testing ${protocol}://127.0.0.1:${port}...`);
				const is_working = await this.test_port(port, csrf_token, protocol);

				if (is_working) {
					logger.info(LOG_CAT, `Port ${port} is working (${protocol})`);
					return {port, protocol};
				}
			}
		}
		return null;
	}

	private test_port(port: number, csrf_token: string, protocol: server_protocol): Promise<boolean> {
		return new Promise(resolve => {
			const payload = JSON.stringify({
				metadata: {
					ideName: 'antigravity',
					extensionName: 'antigravity',
					locale: 'en',
				},
			});
			const transport = protocol === 'https' ? https : http;
			const options: https.RequestOptions = {
				hostname: '127.0.0.1',
				port,
				path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload),
					'X-Codeium-Csrf-Token': csrf_token,
					'Connect-Protocol-Version': '1',
				},
				rejectUnauthorized: false,
				timeout: 5000,
				agent: false,
			};

			logger.debug(LOG_CAT, `HTTP request to ${protocol}://127.0.0.1:${port}${options.path}`);

			const req = transport.request(options, res => {
				logger.debug(LOG_CAT, `Response from ${protocol}://127.0.0.1:${port}: status=${res.statusCode}`);

				let body = '';
				res.on('data', chunk => (body += chunk));
				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							JSON.parse(body);
							resolve(true);
						} catch {
							logger.debug(LOG_CAT, `Port ${port} responded with 200 but body is not valid JSON`);
							resolve(false);
						}
					} else {
						resolve(false);
					}
				});
			});

			req.on('error', (err: any) => {
				logger.debug(LOG_CAT, `Port ${port} ${protocol} connection error: ${err.code || err.message}`);
				resolve(false);
			});

			req.on('timeout', () => {
				logger.debug(LOG_CAT, `Port ${port} ${protocol} connection timeout`);
				req.destroy();
				resolve(false);
			});

			req.write(payload);
			req.end();
		});
	}
}
