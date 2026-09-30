/**
 * Status Bar UI Manager
 */

import * as vscode from 'vscode';
import {quota_snapshot, quota_bucket} from '../utils/types';

export class StatusBarManager {
	private item: vscode.StatusBarItem;
	private last_snapshot: quota_snapshot | undefined;

	constructor() {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.command = 'agq.show_menu';
		this.item.text = '$(rocket) AGQ';
		this.item.show();
	}

	show_loading() {
		this.item.text = '$(sync~spin) AGQ';
		this.item.show();
	}

	show_error(msg: string) {
		this.item.text = '$(error) AGQ';
		this.item.tooltip = msg;
		this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		this.item.show();
	}

	update(snapshot: quota_snapshot) {
		this.last_snapshot = snapshot;

		const pinned = this.get_pinned_buckets();
		const group_parts: string[] = [];

		for (const group of snapshot.groups) {
			const group_prefix = group.display_name.toLowerCase().includes('gemini') ? '✦' : '✺';
			const active_buckets = pinned.length > 0
				? group.buckets.filter(b => pinned.includes(b.bucket_id))
				: group.buckets;

			if (active_buckets.length === 0) {
				continue;
			}

			// Sort so 5-hour comes before weekly
			const sorted_buckets = [...active_buckets].sort((a, b) => {
				const order = (win: string) => (win === '5h' ? 0 : 1);
				return order(a.window) - order(b.window);
			});

			const bucket_texts = sorted_buckets.map(b => {
				const sup_tag = b.window === 'weekly' ? 'ʷ' : 'ʰ';
				const pct = b.remaining_percentage !== undefined ? `${b.remaining_percentage.toFixed(0)}%` : 'N/A';
				return `${pct}${sup_tag}`;
			});

			group_parts.push(`${group_prefix} ${bucket_texts.join(' · ')}`);
		}

		if (group_parts.length === 0) {
			this.item.text = '$(rocket) AGQ';
		} else {
			this.item.text = group_parts.join('   ');
		}

		this.item.backgroundColor = undefined;

		// Build compact Markdown tooltip
		const md = new vscode.MarkdownString('', true);
		md.isTrusted = true;
		md.supportThemeIcons = true;

		const sections: string[] = [];
		for (const group of snapshot.groups) {
			const group_title = group.display_name.replace(/\bmodels\b/i, 'Models');
			const lines = [`**${group_title}**`];

			const sorted_buckets = [...group.buckets].sort((a, b) => {
				const order = (win: string) => (win === '5h' ? 0 : 1);
				return order(a.window) - order(b.window);
			});

			for (const b of sorted_buckets) {
				const label = b.window === 'weekly' ? 'Weekly' : '5-Hour';
				const pct = b.remaining_percentage !== undefined ? `${b.remaining_percentage.toFixed(1)}%` : 'N/A';
				const compact_time = this.format_compact_time(b.reset_time);
				lines.push(`• ${label}: **${pct}** · ${b.reset_countdown} (${compact_time})`);
			}
			sections.push(lines.join('  \n'));
		}

		md.appendMarkdown(sections.join('\n\n'));
		this.item.tooltip = md;

		this.item.show();
	}

	show_menu() {
		const pick = vscode.window.createQuickPick();
		pick.title = 'Antigravity Quota Plus';
		(pick as any).hideInput = true;
		pick.canSelectMany = false;

		pick.items = this.build_menu_items();

		let currentActiveItem: vscode.QuickPickItem | undefined;

		pick.onDidChangeActive(items => {
			currentActiveItem = items[0];
		});

		pick.onDidAccept(async () => {
			if (currentActiveItem && 'bucket_id' in currentActiveItem) {
				const bucket_id = (currentActiveItem as any).bucket_id;
				await this.toggle_pinned_bucket(bucket_id);
				pick.items = this.build_menu_items();
				if (this.last_snapshot) {
					this.update(this.last_snapshot);
				}
			}
		});

		pick.onDidHide(() => {
			pick.dispose();
		});

		pick.show();
	}

	private get_pinned_buckets(): string[] {
		const config = vscode.workspace.getConfiguration('agq');
		return config.get<string[]>('pinnedBuckets') || [];
	}

	private async toggle_pinned_bucket(bucket_id: string): Promise<void> {
		const config = vscode.workspace.getConfiguration('agq');
		const current_pinned = this.get_pinned_buckets();
		const all_buckets = this.last_snapshot?.groups.flatMap(g => g.buckets.map(b => b.bucket_id)) || [];

		let new_pinned: string[];
		if (current_pinned.length === 0) {
			new_pinned = all_buckets.filter(id => id !== bucket_id);
		} else {
			const index = current_pinned.indexOf(bucket_id);
			if (index >= 0) {
				new_pinned = current_pinned.filter(id => id !== bucket_id);
			} else {
				new_pinned = [...current_pinned, bucket_id];
			}
		}

		await config.update('pinnedBuckets', new_pinned, vscode.ConfigurationTarget.Global);
	}

	private build_menu_items(): vscode.QuickPickItem[] {
		const items: vscode.QuickPickItem[] = [];
		const snapshot = this.last_snapshot;
		const pinned = this.get_pinned_buckets();

		if (snapshot && snapshot.groups.length > 0) {
			for (const group of snapshot.groups) {
				// Insert zero-width space in Claude to prevent IDE custom colorizer from turning it purple
				let group_title = group.display_name.replace(/\bmodels\b/i, 'Models');
				group_title = group_title.replace('Claude', 'C\u200Blaude');

				items.push({
					label: group_title,
					kind: vscode.QuickPickItemKind.Separator,
				});

				for (const b of group.buckets) {
					const pct = b.remaining_percentage;
					const pct_display = pct !== undefined ? `${pct.toFixed(1)}%` : 'N/A';
					const bar = pct !== undefined ? this.draw_progress_bar(pct) : '░'.repeat(10);
					const is_pinned = pinned.length > 0 ? pinned.includes(b.bucket_id) : true;

					const symbol = is_pinned ? '▣' : '▢';

					const item: vscode.QuickPickItem & {bucket_id?: string} = {
						label: `${symbol}  ${b.display_name}`,
						description: `${bar} ${pct_display}`,
						detail: `    Reset: ${b.reset_exact_time}  —   ${b.reset_countdown}`,
					};

					(item as any).bucket_id = b.bucket_id;
					items.push(item);
				}
			}
		} else {
			items.push({
				label: '$(info) No quota data',
				description: 'Waiting for quota info...',
			});
		}

		return items;
	}

	private draw_progress_bar(percentage: number): string {
		const total = 10;
		const filled = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * total);
		const empty = total - filled;
		return '▓'.repeat(filled) + '░'.repeat(empty);
	}

	private format_compact_time(date: Date): string {
		const now = new Date();
		const is_today = date.toDateString() === now.toDateString();
		const time_str = date.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		if (is_today) {
			return time_str;
		}
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${month}/${day} ${time_str}`;
	}

	dispose() {
		this.item.dispose();
	}
}
