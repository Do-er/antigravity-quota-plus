/**
 * Antigravity Quota Watcher - Main Entry
 */

import * as vscode from 'vscode';
import {ConfigManager} from './core/config_manager';
import {ProcessFinder} from './core/process_finder';
import {QuotaManager, RECONNECT_REQUIRED} from './core/quota_manager';
import {StatusBarManager} from './ui/status_bar';
import {logger} from './utils/logger';

let config_manager: ConfigManager;
let process_finder: ProcessFinder;
let quota_manager: QuotaManager;
let status_bar: StatusBarManager;
let is_initialized = false;
let is_initializing = false;
let is_reconnecting = false;
let has_shown_not_found_error = false;
let background_retry_timer: NodeJS.Timeout | undefined;

const INIT_MAX_ATTEMPTS = 10;
const INIT_RETRY_BASE_DELAY_MS = 1000;
const INIT_RETRY_MAX_DELAY_MS = 10000;
const BACKGROUND_RETRY_INTERVAL_MS = 30000;

export async function activate(context: vscode.ExtensionContext) {
	logger.init(context);
	logger.section('Extension', 'Antigravity Quota Activating');
	logger.info('Extension', `VS Code Version: ${vscode.version}`);
	logger.info('Extension', `Extension activating at: ${new Date().toISOString()}`);

	config_manager = new ConfigManager();
	process_finder = new ProcessFinder();
	quota_manager = new QuotaManager();
	status_bar = new StatusBarManager();

	context.subscriptions.push(status_bar);

	const config = config_manager.get_config();
	logger.debug('Extension', 'Initial config:', config);

	// Register Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('agq.refresh', () => {
			logger.info('Extension', 'Manual refresh triggered');
			vscode.window.showInformationMessage('Refreshing Quota...');
			quota_manager.fetch_quota();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('agq.show_menu', () => {
			logger.debug('Extension', 'Show menu triggered');
			if (!is_initialized && !is_initializing && !is_reconnecting) {
				logger.info('Extension', 'Extension not initialized yet, triggering immediate detection from menu click');
				void initialize_extension(1, false);
			}
			status_bar.show_menu();
		})
	);

	// Manual activation command
	context.subscriptions.push(
		vscode.commands.registerCommand('agq.activate', async () => {
			logger.info('Extension', 'Manual activation triggered');
			if (!is_initialized) {
				await initialize_extension();
			} else {
				vscode.window.showInformationMessage('AGQ is already active');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('agq.reconnect', async () => {
			logger.info('Extension', 'Reconnect triggered');
			vscode.window.showInformationMessage('Reconnecting to Antigravity process...');
			await reconnect_extension();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('agq.show_logs', () => {
			logger.info('Extension', 'Opening debug log panel');
			logger.show();
			vscode.window.showInformationMessage('Debug log panel opened');
		})
	);

	// Setup Quota Manager Callbacks
	quota_manager.on_update(snapshot => {
		logger.debug('Extension', 'Quota update received:', {
			groups_count: snapshot.groups?.length ?? 0,
			timestamp: snapshot.timestamp,
		});
		status_bar.update(snapshot);
	});

	quota_manager.on_error(err => {
		if (err.message === RECONNECT_REQUIRED) {
			logger.warn('Extension', 'Connection lost, attempting automatic reconnect...');
			void reconnect_extension();
			return;
		}
		logger.error('Extension', `Quota error: ${err.message}`);
		status_bar.show_error(err.message);
	});

	// Initialize extension asynchronously (non-blocking)
	// This prevents blocking VS Code startup
	logger.debug('Extension', 'Starting async initialization...');
	initialize_extension().catch(err => {
		logger.error('Extension', 'Failed to initialize AG Quota Watcher:', err);
	});

	// Handle Config Changes
	context.subscriptions.push(
		config_manager.on_config_change(new_config => {
			logger.info('Extension', 'Config changed:', new_config);
			if (new_config.enabled) {
				quota_manager.start_polling(new_config.polling_interval);
			} else {
				quota_manager.stop_polling();
			}
		})
	);

	logger.info('Extension', 'Extension activation complete');
}

async function reconnect_extension() {
	if (is_reconnecting) {
		logger.debug('Extension', 'Reconnect already in progress, skipping');
		return;
	}

	is_reconnecting = true;
	try {
		is_initialized = false;
		has_shown_not_found_error = false;
		stop_background_retry();
		quota_manager.stop_polling();
		status_bar.show_loading();
		await initialize_extension();
	} finally {
		is_reconnecting = false;
	}
}

function start_background_retry() {
	if (background_retry_timer) {
		return;
	}
	logger.info(
		'Extension',
		`Starting background process check every ${BACKGROUND_RETRY_INTERVAL_MS / 1000}s...`
	);
	background_retry_timer = setInterval(() => {
		if (is_initialized || is_initializing || is_reconnecting) {
			return;
		}
		logger.debug('Extension', 'Background retry checking for Antigravity process...');
		void initialize_extension(1, false);
	}, BACKGROUND_RETRY_INTERVAL_MS);
}

function stop_background_retry() {
	if (background_retry_timer) {
		clearInterval(background_retry_timer);
		background_retry_timer = undefined;
	}
}

async function detect_process_with_retry(max_attempts: number = INIT_MAX_ATTEMPTS) {
	for (let attempt = 1; attempt <= max_attempts; attempt++) {
		const info = await process_finder.detect_process_info();

		if (info) {
			logger.info('Extension', `Process detected on attempt ${attempt}/${max_attempts}`);
			return info;
		}

		if (attempt < max_attempts) {
			const delay = Math.min(INIT_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), INIT_RETRY_MAX_DELAY_MS);
			logger.info(
				'Extension',
				`Process not ready yet (attempt ${attempt}/${max_attempts}), retrying in ${delay}ms...`
			);
			await new Promise(r => setTimeout(r, delay));
		}
	}

	return null;
}

async function initialize_extension(max_attempts: number = INIT_MAX_ATTEMPTS, update_waiting_ui: boolean = true) {
	if (is_initialized || is_initializing) {
		logger.debug('Extension', 'Already initialized or initializing, skipping');
		return;
	}

	is_initializing = true;
	logger.section('Extension', 'Initializing Extension');
	const timer = logger.time_start('initialize_extension');

	const config = config_manager.get_config();
	if (update_waiting_ui) {
		status_bar.show_waiting();
	}

	try {
		logger.info('Extension', 'Detecting Antigravity process...');
		const process_info = await detect_process_with_retry(max_attempts);

		if (process_info) {
			logger.info('Extension', 'Process found successfully', {
				extension_port: process_info.extension_port,
				connect_port: process_info.connect_port,
				csrf_token: process_info.csrf_token.substring(0, 8) + '...',
			});

			stop_background_retry();
			has_shown_not_found_error = false;
			quota_manager.init(process_info.connect_port, process_info.csrf_token);

			if (config.enabled) {
				logger.debug('Extension', `Starting polling with interval: ${config.polling_interval}ms`);
				quota_manager.start_polling(config.polling_interval);
			}
			is_initialized = true;
			logger.info('Extension', 'Initialization successful');
		} else {
			if (!has_shown_not_found_error) {
				logger.error('Extension', 'Antigravity process not found');
				logger.info('Extension', 'Troubleshooting tips:');
				logger.info('Extension', '   1. Make sure Antigravity extension is installed and enabled');
				logger.info('Extension', '   2. Check if the language_server or agy process is running');
				logger.info('Extension', '   3. Try reloading VS Code');
				logger.info('Extension', '   4. Open "Output" panel and select "AGY Quota" for detailed logs');

				status_bar.show_error('Antigravity process not found');
				has_shown_not_found_error = true;
				vscode.window.showErrorMessage('Could not find Antigravity process. Is it running? Use "AGQ: Show Debug Log" to see details.', 'Show Logs').then(action => {
					if (action === 'Show Logs') {
						logger.show();
					}
				});
			} else {
				logger.debug('Extension', 'Antigravity process still not found, will retry in background');
			}

			start_background_retry();
		}
	} catch (e: any) {
		logger.error('Extension', 'Detection failed with exception:', {
			message: e.message,
			stack: e.stack,
		});
		if (!has_shown_not_found_error) {
			status_bar.show_error('Detection failed');
		}
		start_background_retry();
	} finally {
		is_initializing = false;
	}

	timer();
}

export function deactivate() {
	logger.info('Extension', 'Extension deactivating');
	stop_background_retry();
	quota_manager?.stop_polling();
	status_bar?.dispose();
}
