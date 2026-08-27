import { cloneDeep } from 'es-toolkit';
import { ref, type Ref } from 'vue';
import {
  addLineMutation,
  applyDetailMutation,
  buildHeaderMutation,
  removeLineMutation,
  type DetailChangeCommand,
  type DocumentDraft,
  type DocumentLine,
  type EmitEffectConfirmation,
  type EmitEffectMutation,
  type EmitEffectRules,
} from './emit-effect';

export interface UseEmitEffectOptions {
  /** Asked before a mutation that would discard or overwrite line data. */
  confirm?: (confirmation: EmitEffectConfirmation) => boolean | Promise<boolean>;
}

export interface UseEmitEffectReturn<
  H extends Record<string, unknown> = Record<string, unknown>,
  L extends DocumentLine = DocumentLine,
> {
  draft: Ref<DocumentDraft<H, L>>;
  changeHeader: (field: string, value: unknown) => Promise<boolean>;
  changeCell: (command: DetailChangeCommand) => Promise<boolean>;
  addLine: (id: string) => void;
  removeLine: (id: string) => void;
  reset: (next?: DocumentDraft<H, L>) => void;
}

/**
 * Runs header/line emit rules over a document draft.
 *
 * @param rules Field linkage rules applied to every mutation.
 * @param initialDraft Starting draft; cloned, and reused by `reset()`.
 *
 * @example
 * const { draft, changeHeader } = useEmitEffect(salesOrderRules, initialDraft, {
 *   confirm: (confirmation) => confirmDialog(confirmation.message),
 * })
 */
export function useEmitEffect<
  H extends Record<string, unknown> = Record<string, unknown>,
  L extends DocumentLine = DocumentLine,
>(
  rules: EmitEffectRules<H, L>,
  initialDraft: DocumentDraft<H, L>,
  options: UseEmitEffectOptions = {},
): UseEmitEffectReturn<H, L> {
  const { confirm } = options;
  const initial = cloneDeep(initialDraft);
  const draft = ref(cloneDeep(initial)) as Ref<DocumentDraft<H, L>>;

  async function commit(mutation: EmitEffectMutation): Promise<boolean> {
    if (mutation.confirmation) {
      const accepted = await (confirm?.(mutation.confirmation) ?? true);
      if (!accepted) return false;
    }
    draft.value = mutation.nextDraft as DocumentDraft<H, L>;
    return true;
  }

  return {
    draft,
    changeHeader: (field, value) => commit(buildHeaderMutation(rules, draft.value, field, value)),
    changeCell: (command) => commit(applyDetailMutation(rules, draft.value, command)),
    addLine: (id) => {
      draft.value = addLineMutation(rules, draft.value, id).nextDraft as DocumentDraft<H, L>;
    },
    removeLine: (id) => {
      draft.value = removeLineMutation(rules, draft.value, id).nextDraft as DocumentDraft<H, L>;
    },
    reset: (next) => {
      draft.value = cloneDeep(next ?? initial);
    },
  };
}
