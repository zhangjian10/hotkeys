import { memo, useEffect, useState } from "react";
import {
  Button,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import {
  AppFolder20Regular,
  MoreHorizontal20Regular,
} from "@fluentui/react-icons";
import type { Profile } from "../../lib/api";
import { useStyles } from "../../styles/useStyles";

export interface ProfileItemProps {
  profile: Profile;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}

function ProfileItemBase({
  profile,
  active,
  onSelect,
  onRename,
  onRemove,
}: ProfileItemProps) {
  const styles = useStyles();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(profile.name);

  useEffect(() => {
    if (!renaming) setDraft(profile.name);
  }, [profile.name, renaming]);

  const commit = () => {
    const name = draft.trim() || profile.name;
    if (name !== profile.name) onRename(name);
    setRenaming(false);
  };

  return (
    <div
      className={`${styles.profileItem} ${
        active ? styles.profileItemActive : ""
      }`}
      onClick={() => !renaming && onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.profileItemBox}>
        <AppFolder20Regular />
        <div className={styles.profileItemMain}>
          {renaming ? (
            <Input
              autoFocus
              size="small"
              value={draft}
              onChange={(_, d) => setDraft(d.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className={styles.profileItemTitle}>{profile.name}</span>
              <span className={styles.profileItemMeta}>
                {profile.hotkeys.length} 热键 ·{" "}
                {profile.window_keywords.length} 关键词
              </span>
            </>
          )}
        </div>
        {!renaming && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                size="small"
                icon={<MoreHorizontal20Regular />}
                aria-label="更多操作"
                onClick={(e) => e.stopPropagation()}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(true);
                  }}
                >
                  重命名
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  删除
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
    </div>
  );
}

export const ProfileItem = memo(ProfileItemBase);
