/**
 * Quota Manager Service
 */

import * as https from 'https';
import {quota_snapshot, quota_group, quota_bucket, quota_summary_response} from '../utils/types';
import {logger} from '../utils/logger';

export const RECONNECT_REQUIRED = 'RECONNECT_REQUIRED';

export class QuotaManager {
	private port: number = 0;
	private csrf_token: string = '';

	private update_callback?: (snapshot: quota_snapshot) => void;
	private error_callback?: (error: Error) => void;
	private polling_timer?: NodeJS.Timeout;
	private consecutive_errors = 0;
	private readonly MAX_CONSECUTIVE_ERRORS = 3;

	constructor() {}

	init(port: number, csrf_token: string) {
		this.port = port;
		this.csrf_token = csrf_token;
		this.consecutive_errors = 0;
	}

	private request<T>(path: string, body: object): Promise<T> {
		return new Promise((resolve, reject) => {
			const data = JSON.stringify(body);
			const options: https.RequestOptions = {
				hostname: '127.0.0.1',
				port: this.port,
				path,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data),
					'Connect-Protocol-Version': '1',
					'X-Codeium-Csrf-Token': this.csrf_token,
				},
				rejectUnauthorized: false,
				timeout: 5000,
			};

			const req = https.request(options, res => {
				let body = '';
				res.on('data', chunk => (body += chunk));
				res.on('end', () => {
					try {
						resolve(JSON.parse(body) as T);
					} catch {
						reject(new Error('Invalid JSON response'));
					}
				});
			});

			req.on('error', reject);
			req.on('timeout', () => {
				req.destroy();
				reject(new Error('Request timeout'));
			});

			req.write(data);
			req.end();
		});
	}

	on_update(callback: (snapshot: quota_snapshot) => void) {
		this.update_callback = callback;
	}

	on_error(callback: (error: Error) => void) {
		this.error_callback = callback;
	}

	start_polling(interval_ms: number) {
		this.stop_polling();
		this.fetch_quota();
		this.polling_timer = setInterval(() => this.fetch_quota(), interval_ms);
	}

	stop_polling() {
		if (this.polling_timer) {
			clearInterval(this.polling_timer);
			this.polling_timer = undefined;
		}
	}

	async fetch_quota() {
		try {
			const data = await this.request<quota_summary_response>(
				'/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
				{
					metadata: {
						ideName: 'antigravity',
						extensionName: 'antigravity',
						locale: 'en',
					},
				}
			);

			const snapshot = this.parse_response(data);
			this.consecutive_errors = 0;

			if (this.update_callback) {
				this.update_callback(snapshot);
			}
		} catch (error: any) {
			this.consecutive_errors++;
			logger.error(
				'QuotaManager',
				`Fetch failed (${this.consecutive_errors}/${this.MAX_CONSECUTIVE_ERRORS}): ${error.message}`
			);

			if (this.consecutive_errors >= this.MAX_CONSECUTIVE_ERRORS) {
				this.consecutive_errors = 0;
				if (this.error_callback) {
					logger.warn('QuotaManager', 'Triggering reconnect after consecutive failures', error);
					this.error_callback(new Error(RECONNECT_REQUIRED));
				}
			} else if (this.error_callback) {
				this.error_callback(error);
			}
		}
	}

	private parse_response(data: quota_summary_response): quota_snapshot {
		const raw_groups = data.response?.groups || [];
		const now = new Date();

		const groups: quota_group[] = raw_groups.map(rg => {
			const group_name = rg.displayName ?? rg.display_name ?? 'Unknown Group';
			const group_desc = rg.description ?? '';
			const raw_buckets = rg.buckets || [];

			const buckets: quota_bucket[] = raw_buckets.map(b => {
				const bucket_id = b.bucketId ?? b.bucket_id ?? 'unknown';
				const display_name = b.displayName ?? b.display_name ?? bucket_id;
				const description = b.description ?? '';
				const window = b.window ?? '';
				const remaining_fraction = b.remainingFraction ?? b.remaining_fraction;
				const reset_time_raw = b.resetTime ?? b.reset_time;
				const reset_time = reset_time_raw ? new Date(reset_time_raw) : new Date(0);
				const diff = Math.max(0, reset_time.getTime() - now.getTime());

				return {
					bucket_id,
					display_name,
					description,
					window,
					group_name,
					remaining_fraction,
					remaining_percentage: remaining_fraction !== undefined ? remaining_fraction * 100 : undefined,
					reset_time,
					time_until_reset: diff,
					reset_countdown: this.get_countdown(diff),
					reset_exact_time: this.get_exact_time(reset_time),
					time_until_reset_formatted: `${this.get_countdown(diff)} (${this.get_exact_time(reset_time)})`,
				};
			});

			return {
				display_name: group_name,
				description: group_desc,
				buckets,
			};
		});

		logger.debug('QuotaManager', `Parsed ${groups.length} groups with ${groups.reduce((acc, g) => acc + g.buckets.length, 0)} total buckets`);

		return {
			timestamp: now,
			groups,
		};
	}

	private get_countdown(ms: number): string {
		if (ms <= 0) return 'Ready';
		const total_mins = Math.ceil(ms / 60000);
		const days = Math.floor(total_mins / (24 * 60));
		const remaining_hours = Math.floor((total_mins % (24 * 60)) / 60);
		const remaining_mins = total_mins % 60;

		if (days > 0) {
			return `${days}d ${remaining_hours}h`;
		} else if (remaining_hours > 0) {
			return `${remaining_hours}h ${remaining_mins}m`;
		} else {
			return `${remaining_mins}m`;
		}
	}

	private get_exact_time(reset_time: Date): string {
		const date_str = reset_time.toLocaleDateString(undefined, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
		const time_str = reset_time.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		return `${date_str} ${time_str}`;
	}
}
