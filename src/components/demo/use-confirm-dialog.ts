import { ElMessageBox } from 'element-plus';
import type { EmitEffectConfirmation } from '@/composables';

/** Human readable summary of a pending batch rewrite, e.g. for `ElMessageBox`. */
export function describeConfirmation(
  confirmation: EmitEffectConfirmation,
  labels: Record<string, string> = {},
): string {
  const header = labels[confirmation.field] ?? confirmation.field;
  const fields = [...new Set(confirmation.affected.map((ref) => labels[ref.field] ?? ref.field))];
  const preserved =
    confirmation.preservedCount > 0 ? `，保留 ${confirmation.preservedCount} 处手改值` : '';
  return `表头「${header}」变更将重算 ${confirmation.affected.length} 处「${fields.join('、')}」${preserved}，是否继续？`;
}

/**
 * `confirm` option for `useEmitEffect` backed by Element Plus.
 *
 * @example
 * useEmitEffect(form, rules, { confirm: useConfirmDialog(FIELD_LABELS) })
 */
export function useConfirmDialog(
  labels: Record<string, string> = {},
): (confirmation: EmitEffectConfirmation) => Promise<boolean> {
  return async (confirmation) => {
    try {
      await ElMessageBox.confirm(describeConfirmation(confirmation, labels), '确认联动', {
        type: 'warning',
        confirmButtonText: '应用',
        cancelButtonText: '取消',
      });
      return true;
    } catch {
      return false;
    }
  };
}
