import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Checkmark20Regular,
  Copy20Regular,
  Delete20Regular,
  DocumentBulletList20Regular,
  Edit20Regular,
  Play20Regular,
  Settings20Regular,
  Stop20Regular,
} from "@fluentui/react-icons";

import type { DaemonStatus, Profile } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export interface TopBarProps {
  profiles: Profile[];
  activeProfile: number;
  onSelectProfile: (i: number) => void;
  onCreateProfile: (name: string, keyword: string) => void;
  onRenameCurrent: (name: string) => void;
  onDuplicateCurrent: () => void;
  onDeleteCurrent: () => void;
  onOpenSettings: () => void;

  /** daemon 状态；null 表示首次轮询尚未完成。 */
  daemon: DaemonStatus | null;
  onSpawnDaemon: () => void;
  onStopDaemon: () => void;
  onRevealLog: () => void;
}

type DotState = "running" | "inactive" | "down" | "checking";

function dotState(s: DaemonStatus | null): DotState {
  if (s === null) return "checking";
  if (!s.running) return "down";
  return s.active ? "running" : "inactive";
}

function dotLabel(state: DotState, profile: string | null): string {
  switch (state) {
    case "checking":
      return "检查中…";
    case "down":
      return "后端未运行";
    case "inactive":
      return "等待目标窗口";
    case "running":
      return profile ? `运行中 · ${profile}` : "运行中";
  }
}

/**
 * 顶栏（在自绘 TitleBar 下方）：品牌 / Profile 切换 / + 新游戏 / ⚙ 设置。
 * 取代旧 Sidebar 的 profile 列表 + 三段 TabList。
 */
export function TopBar({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onRenameCurrent,
  onDuplicateCurrent,
  onDeleteCurrent,
  onOpenSettings,
  daemon,
  onSpawnDaemon,
  onStopDaemon,
  onRevealLog,
}: TopBarProps) {
  const styles = useStyles();
  const current = profiles[activeProfile];
  const canDelete = profiles.length > 1;
  const state = dotState(daemon);
  const label = dotLabel(state, daemon?.profile ?? null);

  // 「+ 新游戏」mini Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  // 「重命名当前」inline editor
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const submitCreate = () => {
    const name = newName.trim();
    const keyword = newKeyword.trim();
    if (!name) return;
    onCreateProfile(name, keyword);
    setNewName("");
    setNewKeyword("");
    setCreateOpen(false);
  };

  const startRename = () => {
    if (!current) return;
    setRenameDraft(current.name);
    setRenaming(true);
  };

  const submitRename = () => {
    const name = renameDraft.trim();
    if (current && name && name !== current.name) {
      onRenameCurrent(name);
    }
    setRenaming(false);
  };

  return (
    <header className={styles.topBar}>
      <span className={styles.topBrand}>GameMacro</span>

      {renaming && current ? (
        <Input
          autoFocus
          size="small"
          value={renameDraft}
          onChange={(_, d) => setRenameDraft(d.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setRenaming(false);
            }
          }}
          style={{ width: 180 }}
        />
      ) : (
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <MenuButton appearance="subtle" size="small">
              {current ? current.name : "未选择 Profile"}
            </MenuButton>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {profiles.map((p, i) => (
                <MenuItem
                  key={i}
                  icon={
                    i === activeProfile ? <Checkmark20Regular /> : <span />
                  }
                  onClick={() => onSelectProfile(i)}
                >
                  {p.name}
                </MenuItem>
              ))}
              {profiles.length > 0 && current && (
                <>
                  <MenuDivider />
                  <MenuItem icon={<Edit20Regular />} onClick={startRename}>
                    重命名当前
                  </MenuItem>
                  <MenuItem
                    icon={<Copy20Regular />}
                    onClick={onDuplicateCurrent}
                  >
                    复制为新 Profile
                  </MenuItem>
                  <MenuItem
                    icon={<Delete20Regular />}
                    disabled={!canDelete}
                    onClick={onDeleteCurrent}
                  >
                    删除当前
                  </MenuItem>
                </>
              )}
            </MenuList>
          </MenuPopover>
        </Menu>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(_, d) => setCreateOpen(d.open)}
      >
        <DialogTrigger disableButtonEnhancement>
          <Button appearance="secondary" size="small">
            + 新游戏
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>新建 Profile</DialogTitle>
            <DialogContent>
              <div className={styles.dialogForm}>
                <Field label="名称" required>
                  <Input
                    autoFocus
                    placeholder="例如：原神"
                    value={newName}
                    onChange={(_, d) => setNewName(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCreate();
                      }
                    }}
                  />
                </Field>
                <Field
                  label="窗口关键词（可留空，稍后在设置里加）"
                  hint="窗口标题包含这段文字时才生效；留空表示稍后再配。"
                >
                  <Input
                    placeholder="例如：Genshin Impact"
                    value={newKeyword}
                    onChange={(_, d) => setNewKeyword(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCreate();
                      }
                    }}
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                disabled={!newName.trim()}
                onClick={submitCreate}
              >
                创建
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <span className={styles.topBarSpacer} />

      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <MenuButton appearance="subtle" size="small" className={styles.statusBtn}>
            <span
              className={mergeClasses(
                styles.statusDot,
                state === "running" && styles.statusDotRunning,
                state === "inactive" && styles.statusDotInactive,
                state === "down" && styles.statusDotDown,
              )}
            />
            {label}
          </MenuButton>
        </MenuTrigger>
        <MenuPopover>
          <div className={styles.statusMenuHeader}>
            {daemon?.pid ? `PID ${daemon.pid}` : "GameMacro 后端服务"}
          </div>
          <MenuList>
            {state === "down" ? (
              <MenuItem icon={<Play20Regular />} onClick={onSpawnDaemon}>
                启动后端（需要管理员权限）
              </MenuItem>
            ) : (
              <MenuItem icon={<Stop20Regular />} onClick={onStopDaemon}>
                停止后端
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem icon={<DocumentBulletList20Regular />} onClick={onRevealLog}>
              打开日志位置
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <Tooltip content="设置" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<Settings20Regular />}
          aria-label="设置"
          onClick={onOpenSettings}
        />
      </Tooltip>
    </header>
  );
}
