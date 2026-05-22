import {
  Button,
  Tab,
  TabList,
  type TabValue,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add20Regular,
  FolderOpen20Regular,
} from "@fluentui/react-icons";
import type { Profile } from "../../lib/api";
import type { SectionId } from "../../types";
import { NAV_ITEMS } from "../../constants/app";
import { useStyles } from "../../styles/useStyles";
import { ProfileItem } from "./ProfileItem";

export interface SidebarProps {
  profiles: Profile[];
  activeProfile: number;
  section: SectionId;
  path: string;
  onSelectProfile: (i: number) => void;
  onAddProfile: () => void;
  onRenameProfile: (i: number, name: string) => void;
  onRemoveProfile: (i: number) => void;
  onSelectSection: (id: SectionId) => void;
  onReveal: () => void;
}

export function Sidebar({
  profiles,
  activeProfile,
  section,
  path,
  onSelectProfile,
  onAddProfile,
  onRenameProfile,
  onRemoveProfile,
  onSelectSection,
  onReveal,
}: SidebarProps) {
  const styles = useStyles();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.navGroupLabel}>
        <span>配置</span>
        <Tooltip content="新建配置" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Add20Regular />}
            onClick={onAddProfile}
            aria-label="新建配置"
          />
        </Tooltip>
      </div>

      {profiles.map((p, i) => (
        <ProfileItem
          key={i}
          profile={p}
          active={i === activeProfile}
          onSelect={() => onSelectProfile(i)}
          onRename={(name) => onRenameProfile(i, name)}
          onRemove={() => onRemoveProfile(i)}
        />
      ))}

      <div className={styles.navGroupLabel} style={{ marginTop: 12 }}>
        <span>设置</span>
      </div>
      <TabList
        vertical
        appearance="subtle"
        size="medium"
        className={styles.navTabList}
        selectedValue={section}
        onTabSelect={(_, d) => onSelectSection(d.value as SectionId)}
      >
        {NAV_ITEMS.map((item) => (
          <Tab
            key={item.id}
            value={item.id satisfies TabValue}
            icon={{ children: item.icon }}
            className={styles.navTab}
            disabled={activeProfile < 0}
          >
            {item.title}
          </Tab>
        ))}
      </TabList>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.pathBtn}
          onClick={onReveal}
          title="在文件管理器中显示"
        >
          <FolderOpen20Regular />
          <span className={styles.pathBtnText}>{path || "加载中…"}</span>
        </button>
      </div>
    </aside>
  );
}
