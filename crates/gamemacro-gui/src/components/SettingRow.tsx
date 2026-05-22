import type { CSSProperties, ReactNode } from "react";
import { useStyles } from "../styles/useStyles";

export interface SettingRowProps {
  icon?: ReactNode;
  label: ReactNode;
  desc?: ReactNode;
  control: ReactNode;
  divider?: boolean;
  rowStyle?: CSSProperties;
}

/**
 * Win11 设置行：左 icon、中 label/desc、右 control。
 * 支持顶部 / 底部之间画分隔线。
 */
export function SettingRow({
  icon,
  label,
  desc,
  control,
  divider = true,
  rowStyle,
}: SettingRowProps) {
  const styles = useStyles();
  return (
    <>
      <div className={styles.row} style={rowStyle}>
        {icon && <span className={styles.rowIcon}>{icon}</span>}
        <div className={styles.rowMain}>
          <span className={styles.rowLabel}>{label}</span>
          {desc && <span className={styles.rowDesc}>{desc}</span>}
        </div>
        <div className={styles.rowControl}>{control}</div>
      </div>
      {divider && <div className={styles.rowDivider} />}
    </>
  );
}
