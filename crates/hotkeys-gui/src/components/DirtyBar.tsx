import {
  Badge,
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import { ArrowReset20Regular, Save20Regular } from "@fluentui/react-icons";
import { useStyles } from "../styles/useStyles";

export interface DirtyBarProps {
  recording: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onResetAll: () => void;
  onResetPage: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * 顶部"未保存的更改"提示条。
 * 撤销 / 重做 / 重置 / 保存 都集中在这里。
 */
export function DirtyBar({
  recording,
  canUndo,
  canRedo,
  onSave,
  onResetAll,
  onResetPage,
  onUndo,
  onRedo,
}: DirtyBarProps) {
  const styles = useStyles();
  return (
    <div className={styles.dirtyBar}>
      <Badge
        appearance="filled"
        color={recording ? "danger" : "warning"}
        size="small"
      >
        {recording ? "录制中" : "有未保存的更改"}
      </Badge>
      <span className={styles.dirtyText} />
      <div className={styles.dirtyActions}>
        <Button
          appearance="subtle"
          icon={<ArrowReset20Regular />}
          disabled={!canUndo}
          onClick={onUndo}
          title="撤销 (Ctrl+Z)"
        >
          撤销
        </Button>
        <Button
          appearance="subtle"
          disabled={!canRedo}
          onClick={onRedo}
          title="重做 (Ctrl+Y)"
        >
          重做
        </Button>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle">重置 ▾</Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={onResetPage}>重置当前配置</MenuItem>
              <MenuItem onClick={onResetAll}>
                全部重置（恢复到上次保存）
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <Button icon={<Save20Regular />} appearance="primary" onClick={onSave}>
          保存
        </Button>
      </div>
    </div>
  );
}
