/**
 * Antigravity Quota Watcher - type definitions
 */

/** Raw bucket item from RetrieveUserQuotaSummary response */
export interface quota_bucket_raw {
	bucketId?: string;
	bucket_id?: string;
	displayName?: string;
	display_name?: string;
	description?: string;
	window?: string;
	remainingFraction?: number;
	remaining_fraction?: number;
	resetTime?: string;
	reset_time?: string;
}

/** Raw group item from RetrieveUserQuotaSummary response */
export interface quota_group_raw {
	displayName?: string;
	display_name?: string;
	description?: string;
	buckets?: quota_bucket_raw[];
}

/** Complete server response structure for RetrieveUserQuotaSummary */
export interface quota_summary_response {
	response?: {
		groups?: quota_group_raw[];
		description?: string;
	};
}

/** Parsed and enriched quota bucket */
export interface quota_bucket {
	bucket_id: string;
	display_name: string;
	description: string;
	window: string;
	group_name: string;
	remaining_fraction?: number;
	remaining_percentage?: number;
	reset_time: Date;
	time_until_reset: number;
	time_until_reset_formatted: string;
	reset_countdown: string;
	reset_exact_time: string;
}

/** Parsed quota group containing its buckets */
export interface quota_group {
	display_name: string;
	description: string;
	buckets: quota_bucket[];
}

/** Snapshot containing all quota groups */
export interface quota_snapshot {
	timestamp: Date;
	groups: quota_group[];
}

/** Extension runtime configuration */
export interface config_options {
	enabled: boolean;
	polling_interval: number;
}
