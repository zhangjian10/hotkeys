import { useCallback } from "react";
import {
  Toast,
  ToastBody,
  ToastTitle,
  useToastController,
} from "@fluentui/react-components";
import type { ToastKind } from "../types";
import { toastTitle } from "../lib/utils";

const TOAST_TIMEOUT_MS = 2800;

/**
 * useFlash 包装 Fluent UI Toast，统一外观与默认时长。
 */
export function useFlash(toasterId: string) {
  const { dispatchToast } = useToastController(toasterId);

  return useCallback(
    (kind: ToastKind, text: string) => {
      dispatchToast(
        <Toast>
          <ToastTitle>{toastTitle(kind)}</ToastTitle>
          <ToastBody>{text}</ToastBody>
        </Toast>,
        { intent: kind, timeout: TOAST_TIMEOUT_MS },
      );
    },
    [dispatchToast],
  );
}

export type FlashFn = ReturnType<typeof useFlash>;
