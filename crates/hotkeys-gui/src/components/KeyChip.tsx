import { memo } from "react";
import { useStyles } from "../styles/useStyles";

export interface KeyChipProps {
  text: string;
  variant?: "modifier" | "trigger";
}

function KeyChipBase({ text, variant }: KeyChipProps) {
  const styles = useStyles();
  return (
    <span
      className={`${styles.keyChip} ${
        variant === "trigger" ? styles.keyChipTrigger : ""
      }`}
    >
      {text}
    </span>
  );
}

/** KeyChip：键帽外观；用 memo 减少父组件高频更新时的重渲染 */
export const KeyChip = memo(KeyChipBase);
