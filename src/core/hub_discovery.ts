/**
 * Hub discovery file reader.
 *
 * Recent `agy --hub` builds stopped passing `--csrf_token` on the command line and
 * instead publish it in `~/.gemini/<app_data_dir>/daemon/hub_<hub_port>.json`:
 *
 *   {
 *     "pid": 1035,
 *     "httpsPort": 49293,
 *     "httpPort": 49287,
 *     "lsVersion": "2.34.0",
 *     "csrfToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *   }
 *
 * Treating a missing `--csrf_token` as "not an Antigravity process" is what made the
 * extension report "process not found" on macOS (and newer Windows builds), even
 * though `agy` was running and answering quota requests.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {logger} from '../utils/logger';

const LOG_CAT = 'HubDiscovery';

/** `--app_data_dir` values that identify an Antigravity backend. */
const ANTIGRAVITY_APP_DATA_DIRS = ['antigravity', 'antigravity-ide'];

const HUB_FILE_PATTERN = /^hub_\d+\.json$/;

export interface hub_discovery_info {
	pid?: number;
	/** TLS port serving the LanguageServerService over HTTPS. */
	https_port?: number;
	/** Plain HTTP port of the hub (same value as --hub-port). */
	http_port?: number;
	ls_version?: string;
	csrf_token: string;
}

function to_port(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535) {
		return value;
	}
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
		const parsed = parseInt(value.trim(), 10);
		return parsed > 0 && parsed <= 65535 ? parsed : undefined;
	}
	return undefined;
}

/** PIDs are not bounded by the 16-bit port range, so parse them separately. */
function to_pid(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
		const parsed = parseInt(value.trim(), 10);
		return parsed > 0 ? parsed : undefined;
	}
	return undefined;
}

/**
 * Extract a `--name=value` or `--name value` argument from a command line.
 */
export function extract_cli_argument(command_line: string, name: string): string | undefined {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(?:^|\\s)--${escaped}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|(\\S+))`);
	const match = command_line.match(pattern);
	return match?.[1] ?? match?.[2] ?? match?.[3];
}

/**
 * Parse a hub discovery file. Rejects entries whose recorded PID does not match
 * `expected_pid`, so stale files from a previous IDE session are ignored.
 */
export function parse_hub_discovery_json(raw: string, expected_pid?: number): hub_discovery_info | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}

	if (!data || typeof data !== 'object') {
		return null;
	}

	const record = data as Record<string, unknown>;
	const csrf_token = typeof record.csrfToken === 'string' ? record.csrfToken.trim() : '';
	if (!csrf_token) {
		return null;
	}

	const pid = to_pid(record.pid);
	if (expected_pid && pid !== undefined && pid !== expected_pid) {
		logger.debug(LOG_CAT, `Discovery file belongs to PID ${pid}, expected ${expected_pid}; skipping`);
		return null;
	}

	const https_port = to_port(record.httpsPort);
	const http_port = to_port(record.httpPort);
	if (https_port === undefined && http_port === undefined) {
		return null;
	}

	return {
		pid,
		https_port,
		http_port,
		ls_version: typeof record.lsVersion === 'string' ? record.lsVersion : undefined,
		csrf_token,
	};
}

function gemini_root(): string {
	return path.join(os.homedir(), '.gemini');
}

function candidate_app_data_dirs(app_data_dir: string | undefined): string[] {
	if (app_data_dir && ANTIGRAVITY_APP_DATA_DIRS.includes(app_data_dir)) {
		return [app_data_dir];
	}
	return ANTIGRAVITY_APP_DATA_DIRS;
}

/**
 * Read the hub discovery file for an `agy --hub` process.
 *
 * Tries `hub_<hub_port>.json` directly first, then every `hub_*.json` in the daemon
 * directory looking for one whose PID matches (the command line may omit --hub-port).
 */
export function read_hub_discovery(command_line: string, pid: number): hub_discovery_info | null {
	const app_data_dir = extract_cli_argument(command_line, 'app_data_dir')?.toLowerCase();
	const hub_port_raw = extract_cli_argument(command_line, 'hub-port') ?? extract_cli_argument(command_line, 'hub_port');
	const hub_port = hub_port_raw ? parseInt(hub_port_raw, 10) : 0;

	// Only `agy --hub` publishes a discovery file; legacy language_server builds
	// always carry --csrf_token themselves.
	const is_hub_process = hub_port > 0 || /(?:^|\s)--hub(?=\s|$)/i.test(command_line);
	if (!is_hub_process) {
		return null;
	}

	for (const dir of candidate_app_data_dirs(app_data_dir)) {
		const daemon_dir = path.join(gemini_root(), dir, 'daemon');

		if (hub_port > 0) {
			const direct_path = path.join(daemon_dir, `hub_${hub_port}.json`);
			const direct = read_discovery_file(direct_path, pid);
			if (direct) {
				logger.debug(LOG_CAT, `Using discovery file ${direct_path} (PID ${pid})`);
				return direct;
			}
		}

		let entries: string[];
		try {
			entries = fs.readdirSync(daemon_dir).filter(name => HUB_FILE_PATTERN.test(name));
		} catch {
			continue;
		}

		for (const entry of entries) {
			const file_path = path.join(daemon_dir, entry);
			const parsed = read_discovery_file(file_path, pid);
			if (parsed && parsed.pid === pid) {
				logger.debug(LOG_CAT, `Matched discovery file ${file_path} by PID ${pid}`);
				return parsed;
			}
		}
	}

	logger.debug(LOG_CAT, `No hub discovery file for PID ${pid} (app_data_dir: ${app_data_dir ?? 'unknown'}, hub_port: ${hub_port || 'unknown'})`);
	return null;
}

function read_discovery_file(file_path: string, pid: number): hub_discovery_info | null {
	let raw: string;
	try {
		raw = fs.readFileSync(file_path, 'utf8');
	} catch {
		return null;
	}
	return parse_hub_discovery_json(raw, pid);
}

/**
 * Ordered list of ports to probe: the discovery file's HTTPS port first (the API
 * endpoint), then anything already hinted by the command line, then the hub's
 * HTTP port as a last resort.
 */
export function merge_hint_ports(hint_ports: number[], hub: hub_discovery_info | null): number[] {
	const merged: number[] = [];

	const push = (port: number | undefined) => {
		if (port !== undefined && port > 0 && !merged.includes(port)) {
			merged.push(port);
		}
	};

	push(hub?.https_port);
	for (const port of hint_ports) {
		push(port);
	}
	push(hub?.http_port);

	return merged;
}

export interface hub_entry extends hub_discovery_info {
	/** PID recorded in the file; always present for entries returned here. */
	pid: number;
	app_data_dir: string;
	file_path: string;
	mtime_ms: number;
}

function is_pid_alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e: any) {
		// EPERM means the process exists but belongs to another user.
		return e?.code === 'EPERM';
	}
}

/**
 * Last-resort discovery: list every hub discovery file whose PID is still alive,
 * newest first. Used when process-name and command-line scanning both come up empty
 * (for example after `agy` is renamed again, or when pgrep output is unusable).
 */
export function list_hub_discovery_entries(): hub_entry[] {
	const entries: hub_entry[] = [];

	for (const app_data_dir of ANTIGRAVITY_APP_DATA_DIRS) {
		const daemon_dir = path.join(gemini_root(), app_data_dir, 'daemon');

		let files: string[];
		try {
			files = fs.readdirSync(daemon_dir).filter(name => HUB_FILE_PATTERN.test(name));
		} catch {
			continue;
		}

		for (const file of files) {
			const file_path = path.join(daemon_dir, file);
			let raw: string;
			let mtime_ms = 0;
			try {
				raw = fs.readFileSync(file_path, 'utf8');
				mtime_ms = fs.statSync(file_path).mtimeMs;
			} catch {
				continue;
			}

			const parsed = parse_hub_discovery_json(raw);
			if (!parsed?.pid || !is_pid_alive(parsed.pid)) {
				continue;
			}

			entries.push({...parsed, pid: parsed.pid, app_data_dir, file_path, mtime_ms});
		}
	}

	entries.sort((a, b) => b.mtime_ms - a.mtime_ms);
	if (entries.length > 0) {
		logger.debug(LOG_CAT, `Found ${entries.length} live hub discovery entr(ies)`);
	}
	return entries;
}
